import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/** 管理员更新需求状态（状态机流转由运营侧控制，服务端仅校验枚举合法） */
export class UpdateStatusDto {
  @ApiProperty({
    description: '目标状态：PENDING 待评估 / EVALUATING 评估中 / ACCEPTED 已采纳 / DEVELOPING 开发中 / RELEASED 已上线 / REJECTED 已拒绝',
    enum: RequestStatus,
    example: 'ACCEPTED',
  })
  @IsEnum(RequestStatus, { message: 'status 取值不合法' })
  status: RequestStatus;

  @ApiPropertyOptional({ description: '管理员备注', example: '已列入下个迭代计划' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
