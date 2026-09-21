import { Module } from '@nestjs/common';
import { SiteIconsService } from './site-icons.service';
import { SiteIconsBackfillService } from './site-icons-backfill.service';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  controllers: [SitesController],
  providers: [SitesService, SiteIconsService, SiteIconsBackfillService],
  exports: [SiteIconsService],
})
export class SitesModule {}
