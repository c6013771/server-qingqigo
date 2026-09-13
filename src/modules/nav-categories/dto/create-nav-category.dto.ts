import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateNavCategoryDto {
  @ApiProperty({ description: '分类名称', example: '我的工具' })
  @IsString()
  @IsNotEmpty({ message: '分类名称不能为空' })
  @MaxLength(20)
  label: string;
}
