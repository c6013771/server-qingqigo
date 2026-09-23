import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({
    description: '反馈类型：feature 功能建议 / bug 问题反馈 / site 站点收录',
    enum: ['feature', 'bug', 'site'],
    example: 'feature',
  })
  @IsIn(['feature', 'bug', 'site'], { message: 'type 必须是 feature / bug / site 之一' })
  type: string;

  @ApiProperty({ description: '反馈内容（10~1000 字）', example: '希望支持短信登录' })
  @IsString()
  @Length(10, 1000, { message: '内容需在 10~1000 字之间' })
  content: string;

  /** 联系邮箱（选填），处理结果邮件通知用。注意前端按 snake_case 传 contact_email */
  @ApiPropertyOptional({ description: '联系邮箱（选填）', example: 'user@example.com' })
  @IsOptional()
  @IsEmail({}, { message: '联系邮箱格式不正确' })
  @MaxLength(100)
  contact_email?: string;
}
