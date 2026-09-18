import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import * as net from 'net';

/**
 * SSRF 防护共享工具：域名先解析成 IP 再校验，防 DNS 指向内网；IP 字面量直接校验。
 * SitesService（抓页面）与 SiteIconsService（下图标）共用。
 */
export async function assertPublicHost(hostname: string): Promise<void> {
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
  if (!addresses.length || addresses.some((a) => isPrivateIp(a))) {
    throw new BadRequestException('不支持访问内网地址');
  }
}

export function isPrivateIp(ip: string): boolean {
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:') && net.isIPv4(v6.slice(7))) return isPrivateIp(v6.slice(7));
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
