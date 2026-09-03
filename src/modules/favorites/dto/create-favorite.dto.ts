import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateFavoriteDto {
  @ApiProperty({ description: '网站名称', example: 'GitHub' })
  @IsString()
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(50)
  name: string;

  @ApiProperty({ description: '网站链接', example: 'https://github.com' })
  @IsString()
  @IsNotEmpty({ message: '链接不能为空' })
  @MaxLength(500)
  url: string;

  @ApiPropertyOptional({ description: '图标地址', example: 'https://github.com/favicon.ico' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string;

  @ApiPropertyOptional({ description: '排序值（越小越靠前）', example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
