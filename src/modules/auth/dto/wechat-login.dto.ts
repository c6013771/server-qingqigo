import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class WechatLoginDto {
  @ApiProperty({ description: '微信扫码授权回调后带回的一次性登录凭证（ticket）', example: 'abcdef123456' })
  @IsString()
  @IsNotEmpty({ message: '缺少登录凭证' })
  ticket: string;
}