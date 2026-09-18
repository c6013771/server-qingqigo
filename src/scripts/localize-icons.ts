/**
 * 存量图标本地化回填脚本（一次性，部署新代码后执行）：
 * - icon 是外部 http(s) 链接 → 下载落盘到服务器（按站点 host 去重），记录改成本地地址；
 * - icon 是相对路径 /site-icons/... → 补上 ICON_PUBLIC_BASE_URL 前缀（若已配置）；
 * - 已是本地地址 / data: URI / 空 → 跳过。
 *
 * 本地开发：npm run icons:localize（ts-node 直接跑源码）
 * 生产容器：docker exec qingqigo-server npm run icons:localize:prod（跑编译产物）
 */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { SiteIconsService } from '../modules/sites/site-icons.service';

interface Row {
  id: string;
  name: string;
  url: string;
  icon: string | null;
}

async function backfill(
  prisma: PrismaService,
  siteIcons: SiteIconsService,
  publicBase: string,
  table: 'userFavorite' | 'userNavSite',
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[table];
  const rows: Row[] = await delegate.findMany({ where: { icon: { not: null } } });
  let localized = 0;
  let prefixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const icon = row.icon!;
    try {
      if (icon.startsWith('data:')) {
        skipped++;
        continue;
      }
      // 相对路径：已是服务器本地图标，仅补绝对前缀
      if (icon.startsWith('/')) {
        if (publicBase) {
          await delegate.update({ where: { id: row.id }, data: { icon: publicBase + icon } });
          prefixed++;
          console.log(`[补前缀] ${row.name}: ${icon} -> ${publicBase}${icon}`);
        } else {
          skipped++;
        }
        continue;
      }
      // 已是本服务的绝对地址，跳过
      if (publicBase && icon.startsWith(publicBase)) {
        skipped++;
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
  console.log(`[${table}] 共 ${rows.length} 条：本地化 ${localized}，补前缀 ${prefixed}，跳过 ${skipped}，失败 ${failed}`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  try {
    const prisma = app.get(PrismaService);
    const siteIcons = app.get(SiteIconsService);
    const publicBase = app.get(ConfigService).get<string>('icons.publicBase', '').replace(/\/+$/, '');
    // 脚本不经 Nest 生命周期，手动确保存储目录存在
    siteIcons.onModuleInit();

    await backfill(prisma, siteIcons, publicBase, 'userFavorite');
    await backfill(prisma, siteIcons, publicBase, 'userNavSite');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
