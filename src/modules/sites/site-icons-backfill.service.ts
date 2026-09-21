import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SitesService } from './sites.service';

/** 每次最多补抓的空图标记录数：控制每日外网抓取量，避免对目标站造成压力 */
const BATCH_LIMIT = 80;

interface Row {
  id: string;
  name: string;
  url: string;
}

/**
 * 空图标定时回填：每天凌晨扫描收藏/导航中 icon 为空的记录，
 * 走 SitesService 抓取并本地化落盘（内部调用，不受接口每日限流约束）。
 */
@Injectable()
export class SiteIconsBackfillService {
  private readonly logger = new Logger(SiteIconsBackfillService.name);

  constructor(
    private prisma: PrismaService,
    private sites: SitesService,
  ) {}

  /** 每天 03:47 执行（避开整点/半点的任务高峰） */
  @Cron('47 3 * * *')
  async runDaily(): Promise<void> {
    await this.backfillTable('userFavorite');
    await this.backfillTable('userNavSite');
  }

  private async backfillTable(table: 'userFavorite' | 'userNavSite'): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (this.prisma as any)[table];
    const rows: Row[] = await delegate.findMany({ where: { icon: null }, take: BATCH_LIMIT });
    if (!rows.length) return;

    let filled = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const meta = await this.sites.getMeta(row.url, 'icons-backfill', { skipRateLimit: true });
        if (!meta.iconDefault && /^https?:\/\//i.test(meta.icon)) {
          await delegate.update({ where: { id: row.id }, data: { icon: meta.icon } });
          filled++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
        this.logger.warn(`空图标补抓失败 ${row.name} (${row.url}): ${(e as Error).message}`);
      }
    }
    this.logger.log(`[${table}] 空图标补抓完成：成功 ${filled}，失败 ${failed}，本批 ${rows.length} 条`);
  }
}
