import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

/** 天气缓存 10 分钟，IP 定位缓存 24 小时 */
const WEATHER_CACHE_TTL = 600;
const LOCATION_CACHE_TTL = 86400;
/** 上游接口超时时间（毫秒） */
const UPSTREAM_TIMEOUT = 3000;

export interface WeatherResult {
  temp: string;
  text: string;
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  /** 天气：优先读缓存，未命中按「和风 → Open-Meteo → 60s」降级 */
  async getWeather(city: string): Promise<WeatherResult & { cached: boolean }> {
    const key = `weather:${city}`;
    const cached = await this.cacheGet(key);
    if (cached) return { ...JSON.parse(cached), cached: true };

    const providers: Array<[string, (city: string) => Promise<WeatherResult>]> = [
      ['和风', (c) => this.fromQweather(c)],
      ['Open-Meteo', (c) => this.fromOpenMeteo(c)],
      ['60s', (c) => this.from60s(c)],
    ];
    for (const [name, provider] of providers) {
      try {
        const result = await provider(city);
        await this.cacheSet(key, JSON.stringify(result), WEATHER_CACHE_TTL);
        return { ...result, cached: false };
      } catch (e) {
        this.logger.warn(`天气源 ${name} 失败: ${(e as Error).message}`);
      }
    }
    throw new BadGatewayException('所有天气源均不可用');
  }

  /** 和风天气：先城市搜索取 LocationID，再查实时天气 */
  private async fromQweather(city: string): Promise<WeatherResult> {
    const key = this.config.get<string>('qweather.key');
    const host = this.config.get<string>('qweather.host');
    if (!key) throw new Error('未配置 QWEATHER_API_KEY');

    const geo = await this.fetchJson(
      `https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(city)}&key=${key}`,
    );
    const locationId = geo.location?.[0]?.id;
    if (geo.code !== '200' || !locationId) {
      throw new Error(`和风城市搜索失败 code=${geo.code}`);
    }

    const data = await this.fetchJson(
      `https://${host}/v7/weather/now?location=${locationId}&key=${key}`,
    );
    if (data.code !== '200' || !data.now) {
      throw new Error(`和风实时天气失败 code=${data.code}`);
    }
    return { temp: data.now.temp, text: data.now.text };
  }

  /** 备用 1：Open-Meteo（先地理编码取经纬度，再查实时天气） */
  private async fromOpenMeteo(city: string): Promise<WeatherResult> {
    const geo = await this.fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`,
    );
    const loc = geo.results?.[0];
    if (!loc) throw new Error('Open-Meteo 找不到城市');
    const data = await this.fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&timezone=auto`,
    );
    const cur = data.current;
    if (!cur) throw new Error('Open-Meteo 无数据');
    return { temp: String(Math.round(cur.temperature_2m)), text: this.wmoText(cur.weather_code) };
  }

  /** 备用 2：60s API（开源项目 vikiboss/60s） */
  private async from60s(city: string): Promise<WeatherResult> {
    const data = await this.fetchJson(
      `https://60s-api.viki.moe/v2/weather?query=${encodeURIComponent(city)}`,
    );
    const w = data.data?.weather;
    if (!w) throw new Error('60s API 无数据');
    return { temp: String(w.temperature), text: w.condition || '' };
  }

  /** WMO 天气代码 → 中文描述（供 Open-Meteo 使用） */
  private wmoText(code: number): string {
    if (code <= 1) return '晴';
    if (code === 2) return '多云';
    if (code === 3) return '阴';
    if (code === 45 || code === 48) return '雾';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '雨';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '雪';
    if (code >= 95) return '雷';
    return '';
  }

  /** IP 定位：依次降级 ipwho.is → ip-api.com，结果按 IP 缓存 */
  async getCityByIp(ip?: string): Promise<{ city: string; cached: boolean }> {
    // 内网/回环 IP（本地开发常见）无法定位，交给接口按调用方 IP 自动判断
    const queryIp = ip && !this.isPrivateIp(ip) ? ip : '';
    const key = `geo:ip:${queryIp || 'self'}`;
    const cached = await this.cacheGet(key);
    if (cached) return { city: cached, cached: true };

    const providers: Array<[string, (ip: string) => Promise<string | null>]> = [
      ['ipwho.is', (i) => this.cityFromIpwho(i)],
      ['ip-api.com', (i) => this.cityFromIpApi(i)],
    ];
    for (const [name, provider] of providers) {
      try {
        const city = await provider(queryIp);
        if (city) {
          await this.cacheSet(key, city, LOCATION_CACHE_TTL);
          return { city, cached: false };
        }
      } catch (e) {
        this.logger.warn(`IP 定位源 ${name} 失败: ${(e as Error).message}`);
      }
    }
    throw new BadGatewayException('IP 定位失败');
  }

  /** Redis 故障不阻断主流程：读写失败仅记日志 */
  private async cacheGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (e) {
      this.logger.warn(`缓存读取失败: ${(e as Error).message}`);
      return null;
    }
  }

  private async cacheSet(key: string, value: string, ttl: number): Promise<void> {
    try {
      await this.redis.set(key, value, ttl);
    } catch (e) {
      this.logger.warn(`缓存写入失败: ${(e as Error).message}`);
    }
  }

  private async cityFromIpwho(ip: string): Promise<string | null> {
    const data = await this.fetchJson(`https://ipwho.is/${ip}`);
    if (!data?.success) return null;
    return data.city || data.region || null;
  }

  private async cityFromIpApi(ip: string): Promise<string | null> {
    // ip-api.com 免费版仅支持 http，支持查询指定 IP
    const data = await this.fetchJson(
      `http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,regionName,city`,
    );
    if (data?.status !== 'success') return null;
    return data.city || data.regionName || null;
  }

  private isPrivateIp(ip: string): boolean {
    return (
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      /^127\./.test(ip) ||
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );
  }

  private async fetchJson(url: string): Promise<any> {
    const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}
