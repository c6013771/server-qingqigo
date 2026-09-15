import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class QueryForecastDto {
  @ApiPropertyOptional({ description: '手动指定城市，传入后跳过 IP 定位', example: '深圳' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  city?: string;
}
