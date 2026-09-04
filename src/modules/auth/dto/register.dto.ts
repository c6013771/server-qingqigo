import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: '邮箱', example: 'user@example.com' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @ApiProperty({ description: '邮箱验证码（6 位数字，由 /auth/send-code 发送）', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: '验证码为 6 位数字' })
  code: string;

  @ApiProperty({ description: '密码（6-64 位）', example: '123456', minLength: 6, maxLength: 64 })
  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64)
  password: string;

  @ApiPropertyOptional({ description: '昵称（最长 32 字符）', example: '轻启用户' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string;
}
