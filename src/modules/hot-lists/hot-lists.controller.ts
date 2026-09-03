import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HotListsService } from './hot-lists.service';
import { QueryHotListDto } from './dto/query-hot-list.dto';

@ApiTags('热榜')
@Controller('hot-lists')
export class HotListsController {
  constructor(private hotLists: HotListsService) {}

  /** GET /api/hot-lists?source=zhihu|weibo|baidu */
  @ApiOperation({ summary: '获取热榜（缓存 10 分钟）' })
  @Get()
  getHotList(@Query() query: QueryHotListDto) {
    return this.hotLists.getHotList(query.source);
  }
}
