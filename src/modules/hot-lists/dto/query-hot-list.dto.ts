import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const HOT_SOURCES = ['zhihu', 'weibo', 'baidu'] as const;
export type HotSource = (typeof HOT_SOURCES)[number];

export class QueryHotListDto {
  @ApiProperty({ description: '热榜来源', enum: HOT_SOURCES, example: 'zhihu' })
  @IsIn(HOT_SOURCES, { message: 'source 必须是 zhihu / weibo / baidu 之一' })
  source: HotSource;
}
