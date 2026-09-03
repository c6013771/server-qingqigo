import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: '邮箱', example: 'user@example.com' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

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
