import { Module } from '@nestjs/common';
import { SiteIconsService } from './site-icons.service';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';

@Module({
  controllers: [SitesController],
  providers: [SitesService, SiteIconsService],
  exports: [SiteIconsService],
})
export class SitesModule {}
