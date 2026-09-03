import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryRequestsDto {
  @ApiPropertyOptional({ description: '页码，从 1 开始', example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: '每页条数（1-100）', example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({
    description: '按状态过滤：PENDING 待评估 / EVALUATING 评估中 / ACCEPTED 已采纳 / DEVELOPING 开发中 / RELEASED 已上线 / REJECTED 已拒绝',
    enum: RequestStatus,
    example: 'PENDING',
  })
  @IsOptional()
  @IsEnum(RequestStatus, { message: 'status 取值不合法' })
  status?: RequestStatus;
}
