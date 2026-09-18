import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { isAbsolute, join, resolve } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { assertPublicHost } from './ssrf';

/** 下载图标超时（毫秒） */
const FETCH_TIMEOUT = 5000;
/** 图标最大 512KB，防超大文件撑磁盘 */
const MAX_ICON_BYTES = 512 * 1024;

/** content-type → 扩展名；不在表内的类型不落盘（调用方降级为远程地址） */
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/svg+xml': 'svg',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/**
 * 站点图标本地化：下载远程图标落盘到服务器，按 host 全局去重。
 * 其他用户再添加同一站点时直接命中已存文件，不再重复下载。
 */
@Injectable()
export class SiteIconsService implements OnModuleInit {
  private readonly logger = new Logger(SiteIconsService.name);
  private readonly dir: string;
  private readonly publicBase: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    const dir = config.get<string>('icons.dir', './storage/icons');
    this.dir = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
    this.publicBase = config.get<string>('icons.publicBase', '').replace(/\/+$/, '');
  }

  onModuleInit() {
    mkdirSync(this.dir, { recursive: true });
  }

  /**
   * 确保 host 的图标已落盘，返回本地访问地址。
   * 已缓存直接返回；任何失败返回 null，由调用方降级为远程地址，不影响主流程。
   */
  async ensureLocalIcon(host: string, remoteUrl: string): Promise<string | null> {
    try {
      const existing = await this.prisma.siteIcon.findUnique({ where: { host } });
      // DB 有记录且文件确实在磁盘上才算命中（防文件被清理后返回死链）
      if (existing && existsSync(join(this.dir, existing.fileName))) {
        return this.publicUrl(existing.fileName);
      }
      return await this.download(host, remoteUrl, existing?.fileName);
    } catch (e) {
      this.logger.warn(`图标本地化失败 ${host} <- ${remoteUrl}: ${(e as Error).message}`);
      return null;
    }
  }

  private async download(host: string, remoteUrl: string, oldFileName?: string): Promise<string | null> {
    const url = new URL(remoteUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    await assertPublicHost(url.hostname);

    const res = await fetch(remoteUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QingQiErBot/1.0; +https://qingqier.com)' },
    });
    // 重定向后的最终地址也要过一遍 SSRF 校验，防 302 跳内网
    const finalUrl = new URL(res.url || remoteUrl);
    if (finalUrl.protocol !== 'http:' && finalUrl.protocol !== 'https:') return null;
    await assertPublicHost(finalUrl.hostname);
    if (!res.ok || !res.body) return null;

    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return null;

    // 流式读取，超限即中断
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_ICON_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    if (!size) return null;

    // 文件名按 host 确定：并发写同一文件结果一致，upsert 幂等
    const fileName = `${host}.${ext}`;
    await writeFile(join(this.dir, fileName), Buffer.concat(chunks));
    await this.prisma.siteIcon.upsert({
      where: { host },
      update: { fileName, sourceUrl: remoteUrl, contentType: type, sizeBytes: size },
      create: { host, fileName, sourceUrl: remoteUrl, contentType: type, sizeBytes: size },
    });
    // 扩展名变化（如旧 .ico 新 .png）时清理旧文件
    if (oldFileName && oldFileName !== fileName) {
      await unlink(join(this.dir, oldFileName)).catch(() => {});
    }
    this.logger.log(`图标已本地化 ${host} <- ${remoteUrl} (${size}B)`);
    return this.publicUrl(fileName);
  }

  private publicUrl(fileName: string): string {
    return `${this.publicBase}/site-icons/${fileName}`;
  }
}
