import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({
    description: '需求类型：ADD_SITE 添加网站 / ADD_FEATURE 新功能 / IMPROVEMENT 改进建议 / OTHER 其他',
    enum: RequestType,
    example: 'ADD_SITE',
  })
  @IsEnum(RequestType, { message: 'type 必须是 add_site / add_feature / improvement / other 之一' })
  type: RequestType;

  @ApiProperty({ description: '需求标题', example: '希望收录某某导航站' })
  @IsString()
  @IsNotEmpty({ message: '标题不能为空' })
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({ description: '详细描述', example: '这是一个很好用的网站，理由是……' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: '相关链接', example: 'https://example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;

  /** 联系方式，便于运营回访（可选） */
  @ApiPropertyOptional({ description: '联系方式（便于运营回访）', example: 'user@example.com' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact?: string;
}
