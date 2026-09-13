import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateNavSiteDto {
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

  @ApiPropertyOptional({ description: '网站描述', example: 'AI 助手' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  desc?: string;

  @ApiPropertyOptional({ description: '图标地址', example: 'https://github.com/favicon.ico' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  icon?: string;
}
