import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateTodoDto {
  @ApiProperty({ description: '待办内容', example: '给产品回邮件' })
  @IsString()
  @IsNotEmpty({ message: '内容不能为空' })
  @MaxLength(200)
  content: string;

  @ApiProperty({ description: '归属日期（前端本地时区算好的 YYYY-MM-DD）', example: '2026-09-29' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '日期格式必须为 YYYY-MM-DD' })
  date: string;

  @ApiPropertyOptional({ description: '任务状态：todo 未开始 / doing 进行中 / done 完成 / cancelled 取消', example: 'todo', enum: ['todo', 'doing', 'done', 'cancelled'] })
  @IsOptional()
  @IsIn(['todo', 'doing', 'done', 'cancelled'], { message: '状态必须为 todo / doing / done / cancelled' })
  status?: string;

  @ApiPropertyOptional({ description: '排序值（越小越靠前）', example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
