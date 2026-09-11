import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'dns/promises';
import * as net from 'net';
import { RedisService } from '../../redis/redis.service';

/** 站点元信息缓存 24 小时 */
const CACHE_TTL = 86400;
/** 抓取目标站超时（毫秒） */
const FETCH_TIMEOUT = 8000;
/** HTML 最多读取 2MB，防超大页面撑内存 */
const MAX_HTML_BYTES = 2 * 1024 * 1024;
/** 单 IP 每日最多抓取 100 次：接口公开可用，需防被当免费代理刷 */
const IP_DAILY_LIMIT = 100;

export interface SiteMeta {
  title: string;
  /** 抓不到有效图标时兜底为默认图标（iconDefault=true） */
  icon: string;
  /** true 表示 icon 是兜底默认图，而非站点真实图标 */
  iconDefault: boolean;
  /** 跟随重定向后的最终地址（origin） */
  url: string;
}

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);

  constructor(
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  /** 抓取站点标题与图标；抓不到时用域名兜底，接口本身不失败 */
  async getMeta(rawUrl: string, ip: string): Promise<SiteMeta & { cached: boolean }> {
    await this.checkRateLimit(ip);
    const url = await this.normalizeAndCheck(rawUrl);

    const cacheKey = `sitemeta:${url.hostname}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return { ...JSON.parse(cached), cached: true };
    } catch {
      // Redis 不可用时直接抓取
    }

    let title = '';
    let icon = '';
    let finalOrigin = url.origin;
    try {
      const { html, finalUrl } = await this.fetchHtml(url);
      finalOrigin = finalUrl.origin;
      title = this.parseTitle(html);
      icon = await this.pickValidIcon([this.parseIcon(html, finalOrigin), `${finalOrigin}/favicon.ico`]);
    } catch (e) {
      this.logger.warn(`抓取站点信息失败 ${url.href}: ${(e as Error).message}`);
    }

    // 抓不到有效图标时兜底为默认图标，保证前端始终有图可显示
    const iconDefault = !icon;
    const meta: SiteMeta = {
      title: title || url.hostname.replace(/^www\./, ''),
      icon: icon || this.config.get<string>('sites.defaultIcon', '/icons/_default.svg'),
      iconDefault,
      url: finalOrigin,
    };
    try {
      await this.redis.set(cacheKey, JSON.stringify(meta), CACHE_TTL);
    } catch {
      // 缓存失败不影响返回
    }
    return { ...meta, cached: false };
  }

  private async checkRateLimit(ip: string): Promise<void> {
    try {
      const key = `sitemeta:ip:${ip}`;
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 86400);
      if (count > IP_DAILY_LIMIT) {
        throw new HttpException('请求太频繁，请明天再试', HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (e) {
      // Redis 不可用则放行；限流异常不阻断业务
      if (e instanceof HttpException) throw e;
    }
  }

  /** 规范化 URL + SSRF 防护：仅 http/https，且解析结果必须是公网地址 */
  private async normalizeAndCheck(raw: string): Promise<URL> {
    let text = raw.trim();
    if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      throw new BadRequestException('网址格式不正确');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('仅支持 http/https 网址');
    }
    await this.assertPublicHost(url.hostname);
    return url;
  }

  /** 域名先解析成 IP 再校验，防 DNS 指向内网；IP 字面量直接校验 */
  private async assertPublicHost(hostname: string): Promise<void> {
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
      throw new BadRequestException('不支持访问内网地址');
    }
    let addresses: string[];
    if (net.isIP(host)) {
      addresses = [host];
    } else {
      try {
        addresses = (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);
      } catch {
        throw new BadRequestException('域名无法解析');
      }
    }
    if (!addresses.length || addresses.some((a) => this.isPrivateIp(a))) {
      throw new BadRequestException('不支持访问内网地址');
    }
  }

  private isPrivateIp(ip: string): boolean {
    const v6 = ip.toLowerCase();
    if (v6.startsWith('::ffff:') && net.isIPv4(v6.slice(7))) return this.isPrivateIp(v6.slice(7));
    if (
      v6 === '::1' ||
      v6 === '::' ||
      v6.startsWith('fe80:') ||
      v6.startsWith('fc') ||
      v6.startsWith('fd')
    ) {
      return true;
    }
    return (
      /^0\./.test(ip) ||
      /^127\./.test(ip) ||
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
      /^169\.254\./.test(ip) ||
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)
    );
  }

  private async fetchHtml(url: URL): Promise<{ html: string; finalUrl: URL }> {
    const res = await fetch(url.href, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QingQiErBot/1.0; +https://qingqier.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    // 重定向后的最终地址也要过一遍 SSRF 校验，防 302 跳内网
    const finalUrl = new URL(res.url || url.href);
    if (finalUrl.protocol !== 'http:' && finalUrl.protocol !== 'https:') {
      throw new Error('重定向到不支持的协议');
    }
    await this.assertPublicHost(finalUrl.hostname);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (type && !type.includes('text/html') && !type.includes('application/xhtml')) {
      throw new Error('非 HTML 页面');
    }
    if (!res.body) throw new Error('空响应');

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (size >= MAX_HTML_BYTES) {
        await reader.cancel();
        break;
      }
    }
    return { html: new TextDecoder('utf-8').decode(Buffer.concat(chunks)), finalUrl };
  }

  /**
   * 依次校验图标候选地址，返回第一个真实可用的图片地址。
   * 有些站（如 docs.qq.com）的 /favicon.ico 返回 200 但 Content-Type 是 text/html，必须按内容类型验证。
   */
  private async pickValidIcon(candidates: string[]): Promise<string> {
    for (const icon of candidates) {
      if (!icon) continue;
      if (icon.startsWith('data:')) {
        if (icon.startsWith('data:image/')) return icon;
        continue;
      }
      try {
        const iconUrl = new URL(icon);
        if (iconUrl.protocol !== 'http:' && iconUrl.protocol !== 'https:') continue;
        await this.assertPublicHost(iconUrl.hostname);
        let res = await fetch(icon, {
          method: 'HEAD',
          signal: AbortSignal.timeout(4000),
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QingQiErBot/1.0; +https://qingqier.com)' },
        });
        // 部分服务器不支持 HEAD，退化为 GET 只读响应头
        if (res.status === 405) {
          res = await fetch(icon, {
            signal: AbortSignal.timeout(4000),
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QingQiErBot/1.0; +https://qingqier.com)' },
          });
          await res.body?.cancel();
        }
        const type = res.headers.get('content-type') || '';
        if (res.ok && (type.startsWith('image/') || type.includes('icon'))) return icon;
      } catch {
        // 校验失败换下一个候选
      }
    }
    return '';
  }

  /** 标题优先取 og:title（通常是站名而非整句标题），退化为 <title> */
  private parseTitle(html: string): string {
    const head = html.slice(0, 100 * 1024);
    const og =
      head.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
      head.match(/<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
    if (og?.[1]?.trim()) return this.decodeEntities(og[1].trim());
    const t = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return t?.[1] ? this.decodeEntities(t[1].trim()) : '';
  }

  /** 图标优先级：apple-touch-icon > 页面声明的 icon（/favicon.ico 兜底在调用方处理） */
  private parseIcon(html: string, base: string): string {
    const head = html.slice(0, 100 * 1024);
    const links = head.match(/<link\b[^>]*>/gi) || [];
    let icon = '';
    let apple = '';
    for (const tag of links) {
      const rel = tag.match(/rel=["']([^"']*)["']/i)?.[1]?.toLowerCase() || '';
      const href = tag.match(/href=["']([^"']*)["']/i)?.[1];
      if (!href) continue;
      if (rel.includes('apple-touch-icon')) {
        if (!apple) apple = href;
      } else if (/\bicon\b/.test(rel) && !icon) {
        icon = href;
      }
    }
    const chosen = apple || icon;
    if (!chosen) return '';
    try {
      return new URL(chosen, base).href;
    } catch {
      return '';
    }
  }

  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
}
