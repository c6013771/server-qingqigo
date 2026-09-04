import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendCodeDto {
  @ApiProperty({ description: '接收验证码的邮箱', example: 'user@example.com' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;
}
