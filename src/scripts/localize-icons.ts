/**
 * 存量图标本地化回填脚本（一次性，部署新代码后执行）：
 * - icon 为空 → 调 SitesService 实时抓取并本地化，写回记录；
 * - icon 是外部 http(s) 链接 → 下载落盘到服务器（按站点 host 去重），记录改成本地地址；
 * - icon 是相对路径 /site-icons/... → 补上 ICON_PUBLIC_BASE_URL 前缀（若已配置）；
 * - 已是本地地址 → 校验文件仍在磁盘上，丢失则按 sourceUrl 重新下载；
 * - data: URI / 前端资源路径（/icons/...）→ 跳过。
 *
 * 本地开发：npm run icons:localize（ts-node 直接跑源码）
 * 生产容器：docker exec qingqigo-server npm run icons:localize:prod（跑编译产物）
 */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { SiteIconsService } from '../modules/sites/site-icons.service';
import { SitesService } from '../modules/sites/sites.service';

/** 空图标回填时走抓取接口的固定来源标识（受每日 100 次限流约束） */
const SCRIPT_IP = 'icons-localize-script';

interface Row {
  id: string;
  name: string;
  url: string;
  icon: string | null;
}

async function backfill(
  prisma: PrismaService,
  siteIcons: SiteIconsService,
  sites: SitesService,
  publicBase: string,
  table: 'userFavorite' | 'userNavSite',
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[table];
  const rows: Row[] = await delegate.findMany();
  let localized = 0;
  let prefixed = 0;
  let filled = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const icon = row.icon;
    try {
      // icon 为空：实时抓取站点信息（内部已做本地化落盘），成功则写回
      if (!icon) {
        const meta = await sites.getMeta(row.url, SCRIPT_IP);
        if (!meta.iconDefault && /^https?:\/\//i.test(meta.icon)) {
          await delegate.update({ where: { id: row.id }, data: { icon: meta.icon } });
          filled++;
          console.log(`[空图标补抓] ${row.name}: -> ${meta.icon}`);
        } else {
          failed++;
          console.warn(`[抓不到图标] ${row.name} (${row.url})`);
        }
        continue;
      }
      if (icon.startsWith('data:')) {
        skipped++;
        continue;
      }
      // 相对路径：仅 /site-icons/ 是后端本地图标，补 API 域名前缀；
      // /icons/ 等是前端静态资源（www 域名），不能补前缀，跳过
      if (icon.startsWith('/')) {
        if (icon.startsWith('/site-icons/') && publicBase) {
          await delegate.update({ where: { id: row.id }, data: { icon: publicBase + icon } });
          prefixed++;
          console.log(`[补前缀] ${row.name}: ${icon} -> ${publicBase}${icon}`);
        } else {
          skipped++;
        }
        continue;
      }
      // 已是本服务的绝对地址：校验文件仍在磁盘上，丢失则按 sourceUrl 重新下载
      if (publicBase && icon.startsWith(publicBase)) {
        if (await siteIcons.repairLocalIcon(icon)) {
          skipped++;
        } else {
          failed++;
          console.warn(`[本地文件缺失且无法重下] ${row.name}: ${icon}`);
        }
        continue;
      }
      if (!/^https?:\/\//i.test(icon)) {
        skipped++;
        continue;
      }
      // 外部链接：按站点 host 下载落盘（与其他用户共享去重）
      const host = new URL(row.url).hostname;
      const local = await siteIcons.ensureLocalIcon(host, icon);
      if (local && local !== icon) {
        await delegate.update({ where: { id: row.id }, data: { icon: local } });
        localized++;
        console.log(`[本地化] ${row.name} (${host}): ${icon} -> ${local}`);
      } else {
        failed++;
        console.warn(`[失败保留原样] ${row.name} (${host}): ${icon}`);
      }
    } catch (e) {
      failed++;
      console.warn(`[失败保留原样] ${row.name}: ${icon} (${(e as Error).message})`);
    }
  }
  console.log(
    `[${table}] 共 ${rows.length} 条：空图标补抓 ${filled}，外链本地化 ${localized}，补前缀 ${prefixed}，跳过 ${skipped}，失败 ${failed}`,
  );
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  try {
    const prisma = app.get(PrismaService);
    const siteIcons = app.get(SiteIconsService);
    const sites = app.get(SitesService);
    const publicBase = app.get(ConfigService).get<string>('icons.publicBase', '').replace(/\/+$/, '');
    // 脚本不经 Nest 生命周期，手动确保存储目录存在
    siteIcons.onModuleInit();

    await backfill(prisma, siteIcons, sites, publicBase, 'userFavorite');
    await backfill(prisma, siteIcons, sites, publicBase, 'userNavSite');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
