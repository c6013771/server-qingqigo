import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderNavCategoriesDto {
  @ApiProperty({ description: '按展示顺序排列的分类 id 列表（须包含当前用户的全部分类）', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  ids: string[];
}
