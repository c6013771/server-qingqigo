import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { WechatService } from './wechat.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { SendResetCodeDto } from './dto/send-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private wechat: WechatService,
  ) {}

  @ApiOperation({ summary: '获取微信扫码登录二维码授权地址' })
  @Get('wechat/authorize-url')
  wechatAuthorizeUrl() {
    return this.wechat.buildAuthorizeUrl();
  }

  @ApiOperation({ summary: '微信扫码授权回调（微信服务器 302 跳转入口，无权限校验）' })
  @Get('wechat/callback')
  wechatCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    return this.wechat.handleCallback(code, state, res);
  }

  @ApiOperation({ summary: '微信扫码登录：一次性 ticket 换取 JWT' })
  @Post('wechat/login')
  @HttpCode(HttpStatus.OK)
  wechatLogin(@Body() dto: WechatLoginDto) {
    return this.wechat.loginWithTicket(dto.ticket);
  }

  @ApiOperation({ summary: '发送注册验证码（10 分钟有效，60 秒重发间隔）' })
  @Post('send-code')
  @HttpCode(HttpStatus.OK)
  sendCode(@Body() dto: SendCodeDto, @Ip() ip: string) {
    return this.auth.sendCode(dto, ip);
  }

  @ApiOperation({ summary: '注册（邮箱 + 验证码 + 密码）' })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @ApiOperation({ summary: '发送找回密码验证码（10 分钟有效，60 秒重发间隔）' })
  @Post('send-reset-code')
  @HttpCode(HttpStatus.OK)
  sendResetCode(@Body() dto: SendResetCodeDto, @Ip() ip: string) {
    return this.auth.sendResetCode(dto, ip);
  }

  @ApiOperation({ summary: '验证码 + 新密码重置密码' })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiOperation({ summary: '登录，返回 JWT' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }
}
