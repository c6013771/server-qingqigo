import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendCodeDto } from './dto/send-code.dto';

/** 验证码 10 分钟有效、60 秒重发间隔、单邮箱每日最多 10 次 */
const CODE_TTL = 600;
const RESEND_INTERVAL = 60;
const DAILY_LIMIT = 10;

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private redis: RedisService,
    private mail: MailService,
  ) {}

  /** 发送注册验证码 */
  async sendCode(dto: SendCodeDto) {
    const email = dto.email.trim().toLowerCase();

    const exists = await this.users.findByEmail(email);
    if (exists) throw new ConflictException('该邮箱已注册');

    if (await this.redis.get(`verify:resend:${email}`)) {
      throw new BadRequestException('发送太频繁，请 60 秒后再试');
    }
    const dailyKey = `verify:daily:${email}`;
    const count = await this.redis.incr(dailyKey);
    if (count === 1) await this.redis.expire(dailyKey, 86400);
    if (count > DAILY_LIMIT) {
      throw new BadRequestException('该邮箱今日发送次数已达上限，请明天再试');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.mail.sendVerifyCode(email, code);
    // 发送成功才落验证码和重发间隔，避免邮件服务故障时误锁用户
    await this.redis.set(`verify:${email}`, code, CODE_TTL);
    await this.redis.set(`verify:resend:${email}`, '1', RESEND_INTERVAL);
    return { sent: true };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    // 先校验验证码（不暴露邮箱是否已注册）
    const key = `verify:${email}`;
    const code = await this.redis.get(key);
    if (!code || code !== dto.code) throw new BadRequestException('验证码错误或已过期');

    const exists = await this.users.findByEmail(email);
    if (exists) throw new ConflictException('该邮箱已注册');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email,
      passwordHash,
      nickname: dto.nickname,
    });
    // 验证成功后立即作废，防止复用
    await this.redis.del(key);
    return this.buildAuthResult(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email.trim().toLowerCase());
    // 统一提示，避免暴露账号是否存在
    if (!user?.passwordHash) throw new UnauthorizedException('邮箱或密码错误');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('邮箱或密码错误');

    await this.users.touchLastLogin(user.id);
    return this.buildAuthResult(user);
  }

  /** 签发 JWT 并返回基础用户信息 */
  private buildAuthResult(user: { id: string; email: string | null; nickname: string | null; role: string }) {
    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return {
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role },
    };
  }
}
