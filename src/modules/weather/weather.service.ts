import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

/** 天气缓存 10 分钟，7 天预报缓存 30 分钟，IP 定位缓存 24 小时 */
const WEATHER_CACHE_TTL = 600;
const FORECAST_CACHE_TTL = 1800;
const LOCATION_CACHE_TTL = 86400;
/** 上游接口超时时间（毫秒） */
const UPSTREAM_TIMEOUT = 10000;

export interface WeatherResult {
  temp: string;
  text: string;
}

export interface ForecastDay {
  /** YYYY-MM-DD */
  date: string;
  text: string;
  tempMin: string;
  tempMax: string;
}

export interface WeatherForecast extends WeatherResult {
  city: string;
  /** 未来 7 天（含今天） */
  days: ForecastDay[];
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
      `https://${host}/v7/weather/now?location=${locationId}&key=${key}&lang=zh`,
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

  /** 按请求 IP 定位城市，返回实时天气 + 未来 7 天预报（和风为主，Open-Meteo 兜底，缓存 30 分钟） */
  async getForecastByIp(ip?: string): Promise<WeatherForecast & { cached: boolean }> {
    const queryIp = ip && !this.isPrivateIp(ip) ? ip : '';
    const key = `weather:forecast7:${queryIp || 'self'}`;
    const cached = await this.cacheGet(key);
    if (cached) return { ...JSON.parse(cached), cached: true };

    const { city } = await this.getCityByIp(ip);
    const providers: Array<[string, (city: string) => Promise<Omit<WeatherForecast, 'city'>>]> = [
      ['和风', (c) => this.forecastFromQweather(c)],
      ['Open-Meteo', (c) => this.forecastFromOpenMeteo(c)],
    ];
    for (const [name, provider] of providers) {
      try {
        const result = await provider(city);
        const forecast: WeatherForecast = { city, ...result };
        await this.cacheSet(key, JSON.stringify(forecast), FORECAST_CACHE_TTL);
        return { ...forecast, cached: false };
      } catch (e) {
        this.logger.warn(`7 天预报源 ${name} 失败: ${(e as Error).message}`);
      }
    }
    throw new BadGatewayException('所有天气源均不可用');
  }

  /** 手动指定城市：跳过 IP 定位，返回实时天气 + 未来 7 天预报（缓存 30 分钟） */
  async getForecastByCity(city: string): Promise<WeatherForecast & { cached: boolean }> {
    const name = await this.resolveCityName(city);
    const key = `weather:forecast7:city:${name}`;
    const cached = await this.cacheGet(key);
    if (cached) return { ...JSON.parse(cached), cached: true };

    const providers: Array<[string, (city: string) => Promise<Omit<WeatherForecast, 'city'>>]> = [
      ['和风', (c) => this.forecastFromQweather(c)],
      ['Open-Meteo', (c) => this.forecastFromOpenMeteo(c)],
    ];
    for (const [providerName, provider] of providers) {
      try {
        const result = await provider(name);
        const forecast: WeatherForecast = { city: name, ...result };
        await this.cacheSet(key, JSON.stringify(forecast), FORECAST_CACHE_TTL);
        return { ...forecast, cached: false };
      } catch (e) {
        this.logger.warn(`7 天预报源 ${providerName} 失败: ${(e as Error).message}`);
      }
    }
    throw new BadGatewayException('所有天气源均不可用');
  }

  /** 和风 7 天预报：城市搜索取 LocationID，实时 + 逐天预报各查一次 */
  private async forecastFromQweather(city: string): Promise<Omit<WeatherForecast, 'city'>> {
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

    const [now, daily] = await Promise.all([
      this.fetchJson(`https://${host}/v7/weather/now?location=${locationId}&key=${key}&lang=zh`),
      this.fetchJson(`https://${host}/v7/weather/7d?location=${locationId}&key=${key}&lang=zh`),
    ]);
    if (now.code !== '200' || !now.now) throw new Error(`和风实时天气失败 code=${now.code}`);
    if (daily.code !== '200' || !daily.daily?.length) throw new Error(`和风 7 天预报失败 code=${daily.code}`);
    return {
      temp: now.now.temp,
      text: now.now.text,
      days: daily.daily.slice(0, 7).map((d: any) => ({
        date: d.fxDate,
        text: d.textDay,
        tempMin: d.tempMin,
        tempMax: d.tempMax,
      })),
    };
  }

  /** Open-Meteo 7 天预报：地理编码后一次请求取实时 + 逐天预报 */
  private async forecastFromOpenMeteo(city: string): Promise<Omit<WeatherForecast, 'city'>> {
    const geo = await this.fetchJson(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`,
    );
    const loc = geo.results?.[0];
    if (!loc) throw new Error('Open-Meteo 找不到城市');
    const data = await this.fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
        `&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=auto`,
    );
    const cur = data.current;
    const daily = data.daily;
    if (!cur || !daily?.time?.length) throw new Error('Open-Meteo 无数据');
    return {
      temp: String(Math.round(cur.temperature_2m)),
      text: this.wmoText(cur.weather_code),
      days: daily.time.slice(0, 7).map((date: string, i: number) => ({
        date,
        text: this.wmoText(daily.weather_code[i]),
        tempMin: String(Math.round(daily.temperature_2m_min[i])),
        tempMax: String(Math.round(daily.temperature_2m_max[i])),
      })),
    };
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

  /** IP 定位：依次降级 ipwho.is → ip-api.com，结果按 IP 缓存；城市名统一转为中文 */
  async getCityByIp(ip?: string): Promise<{ city: string; cached: boolean }> {
    const result = await this.lookupCityByIp(ip);
    return { city: await this.resolveCityName(result.city), cached: result.cached };
  }

  /** 城市名中文化：拼音/英文名 → 中文名（和风 GeoAPI，lang=zh），结果缓存 24 小时 */
  private async resolveCityName(city: string): Promise<string> {
    if (/[一-龥]/.test(city)) return city;
    const key = `geo:name:${city.toLowerCase()}`;
    const cached = await this.cacheGet(key);
    if (cached) return cached;

    try {
      const qKey = this.config.get<string>('qweather.key');
      const host = this.config.get<string>('qweather.host');
      if (qKey) {
        const geo = await this.fetchJson(
          `https://${host}/geo/v2/city/lookup?location=${encodeURIComponent(city)}&key=${qKey}&lang=zh`,
        );
        const name = geo.code === '200' ? geo.location?.[0]?.name : null;
        if (name) {
          await this.cacheSet(key, name, LOCATION_CACHE_TTL);
          return name;
        }
      }
    } catch (e) {
      this.logger.warn(`城市名中文化失败: ${(e as Error).message}`);
    }
    return city;
  }

  /** IP 定位：依次降级 高德 → ipwho.is → ip-api.com，结果按 IP 缓存 */
  private async lookupCityByIp(ip?: string): Promise<{ city: string; cached: boolean }> {
    // 内网/回环 IP（本地开发常见）无法定位，按本机公网 IPv4 出口定位
    const queryIp = ip && !this.isPrivateIp(ip) ? ip : await this.resolveSelfIpv4();
    const key = `geo:ip:${queryIp || 'self'}`;
    const cached = await this.cacheGet(key);
    if (cached) return { city: cached, cached: true };

    const providers: Array<[string, (ip: string) => Promise<string | null>]> = [
      ['高德', (i) => this.cityFromAmap(i)],
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

  /** 高德 IP 定位：国内运营商 IP 比国外库准得多，直接返回中文省市 */
  private async cityFromAmap(ip: string): Promise<string | null> {
    const key = this.config.get<string>('amap.key');
    if (!key) throw new Error('未配置 AMAP_API_KEY');
    // ip 为空时按调用方（本服务器）IP 定位，与其它兜底源行为一致
    const data = await this.fetchJson(`https://restapi.amap.com/v3/ip?key=${key}&ip=${ip}`);
    if (data?.status !== '1') throw new Error(`高德 IP 定位失败 infocode=${data?.infocode}`);
    // 定位不到时 city/province 可能是空数组；仅识别到省时退回省级
    const pick = (v: unknown) => (typeof v === 'string' && v ? v : '');
    const raw = pick(data.city) || pick(data.province);
    // 去掉行政区后缀（深圳市 → 深圳），便于和风城市搜索
    return raw.replace(/(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)$/, '') || null;
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

  /**
   * 获取本机公网 IPv4 出口 IP。
   * 出口优先走 IPv6 时，定位源会拿到归属地数据极差的 IPv6 地址（常被识别为北京），
   * 因此固定走 IPv4-only 接口取 IPv4；多源兜底，全部失败返回空串，由定位源按调用方 IP 自行判断
   */
  private async resolveSelfIpv4(): Promise<string> {
    const sources = [
      'https://ddns.oray.com/checkip',
      'http://members.3322.org/dyndns/getip',
      'https://4.ipw.cn',
    ];
    for (const url of sources) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // 各源返回格式不一（纯 IP 或一段文本），统一从响应中提取首个 IPv4
        const ip = (await res.text()).match(/\d{1,3}(?:\.\d{1,3}){3}/)?.[0] ?? '';
        if (ip) return ip;
      } catch {
        // 单源失败尝试下一个
      }
    }
    this.logger.warn('获取本机公网 IPv4 失败：所有来源均不可用');
    return '';
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
