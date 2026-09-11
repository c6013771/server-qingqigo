import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class QuerySiteMetaDto {
  @ApiProperty({ description: '站点网址（可省略协议头）', example: 'github.com' })
  @IsString()
  @IsNotEmpty({ message: '网址不能为空' })
  url: string;
}
