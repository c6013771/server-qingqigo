import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderNavSitesDto {
  @ApiProperty({ description: '按展示顺序排列的网站 id 列表（须包含当前分类的全部网站）', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids: string[];
}
