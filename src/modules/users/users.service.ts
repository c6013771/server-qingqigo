import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByWxOpenid(wxOpenid: string) {
    return this.prisma.user.findUnique({ where: { wxOpenid } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** 微信扫码登录：按 openid 创建新用户（无邮箱/密码） */
  createWithWechat(data: { wxOpenid: string; nickname?: string; avatarUrl?: string }) {
    return this.prisma.user.create({
      data: {
        wxOpenid: data.wxOpenid,
        nickname: data.nickname ?? '微信用户',
        avatarUrl: data.avatarUrl,
      },
    });
  }

  /** 注册创建用户，昵称缺省取邮箱前缀 */
  create(data: { email: string; passwordHash: string; nickname?: string }) {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        nickname: data.nickname || data.email.split('@')[0],
      },
    });
  }

  /** 微信扫码登录后异步回填昵称与头像（仅更新有值的字段） */
  updateWechatProfile(id: string, data: { nickname?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.nickname ? { nickname: data.nickname } : {}),
        ...(data.avatarUrl ? { avatarUrl: data.avatarUrl } : {}),
      },
    });
  }

  touchLastLogin(id: string) {
    return this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }
}
