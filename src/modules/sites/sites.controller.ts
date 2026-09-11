import { Controller, Get, Headers, Ip, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SitesService } from './sites.service';
import { QuerySiteMetaDto } from './dto/query-site-meta.dto';

@ApiTags('站点')
@Controller('sites')
export class SitesController {
  constructor(private sites: SitesService) {}

  /** GET /api/sites/meta?url=github.com —— 抓取站点标题与图标 */
  @ApiOperation({ summary: '抓取站点标题与图标（缓存 24 小时，抓取失败时用域名兜底）' })
  @Get('meta')
  getMeta(@Query() query: QuerySiteMetaDto, @Ip() ip: string, @Headers('x-forwarded-for') forwarded?: string) {
    // 反向代理（Nginx 等）场景下真实客户端 IP 在 X-Forwarded-For 首段
    const clientIp = forwarded?.split(',')[0]?.trim() || ip;
    return this.sites.getMeta(query.url, clientIp);
  }
}
