import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RedisService } from '../../redis/redis.service';
import { MailService } from '../../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { SendResetCodeDto } from './dto/send-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

/** 验证码 10 分钟有效、60 秒重发间隔、单邮箱每日最多 10 次 */
const CODE_TTL = 600;
const RESEND_INTERVAL = 60;
const DAILY_LIMIT = 10;
/** 单 IP 每日最多发码 30 次：防止遍历不同邮箱绕过单邮箱上限，轰炸他人收件箱 */
const IP_DAILY_LIMIT = 30;

/** 验证码场景的 Redis key 命名空间：verify=注册，reset=找回密码 */
type CodeScene = 'verify' | 'reset';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private redis: RedisService,
    private mail: MailService,
  ) {}

  /** 发送注册验证码 */
  async sendCode(dto: SendCodeDto, ip: string) {
    const email = dto.email.trim().toLowerCase();

    const exists = await this.users.findByEmail(email);
    if (exists) throw new ConflictException('该邮箱已注册');

    return this.sendCodeWithLimit(email, 'verify', 'register-code', ip);
  }

  /** 发送找回密码验证码 */
  async sendResetCode(dto: SendResetCodeDto, ip: string) {
    const email = dto.email.trim().toLowerCase();

    const exists = await this.users.findByEmail(email);
    // 邮箱未注册时也按发送成功返回，不暴露账号是否存在（与登录的统一提示同理）
    if (!exists) return { sent: true };

    return this.sendCodeWithLimit(email, 'reset', 'reset-code', ip);
  }

  /** 验证码 + 新密码重置 */
  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();

    const key = 'reset:' + email;
    const code = await this.redis.get(key);
    if (!code || code !== dto.code) throw new BadRequestException('验证码错误或已过期');

    const user = await this.users.findByEmail(email);
    // 验证码存在说明发码时已确认账号存在，这里只是兜底，且不暴露账号是否存在
    if (!user) throw new BadRequestException('验证码错误或已过期');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.users.updatePassword(user.id, passwordHash);
    // 验证成功后立即作废，防止复用
    await this.redis.del(key);
    return { reset: true };
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

  /**
   * 各场景共用的验证码发送：60 秒重发间隔 + 每日上限限流。
   * 重发间隔用 SET NX EX 在发信前原子占位，防止并发请求在检查通过、
   * 占位写入前的空档里同时通过校验导致重复发信；
   * 邮件发送失败时释放占位，避免邮件服务故障误锁用户。
   */
  private async sendCodeWithLimit(email: string, scene: CodeScene, template: 'register-code' | 'reset-code', ip: string) {
    // 先卡 IP 总量：单邮箱限制防不了换邮箱轰炸，这里是兜底
    const ipKey = `code:ip:${ip}`;
    const ipCount = await this.redis.incr(ipKey);
    if (ipCount === 1) await this.redis.expire(ipKey, 86400);
    if (ipCount > IP_DAILY_LIMIT) {
      throw new BadRequestException('操作太频繁，请明天再试');
    }

    // 原子占位：key 已存在（60 秒内发过）则返回 null，并发下只有第一个请求能拿到锁
    const resendKey = `${scene}:resend:${email}`;
    const locked = await this.redis.getClient().set(resendKey, '1', 'EX', RESEND_INTERVAL, 'NX');
    if (!locked) {
      throw new BadRequestException('发送太频繁，请 60 秒后再试');
    }

    const dailyKey = `${scene}:daily:${email}`;
    const count = await this.redis.incr(dailyKey);
    if (count === 1) await this.redis.expire(dailyKey, 86400);
    if (count > DAILY_LIMIT) {
      await this.redis.del(resendKey);
      throw new BadRequestException('该邮箱今日发送次数已达上限，请明天再试');
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    try {
      await this.mail.send(email, template, { code });
    } catch (err) {
      // 发信失败释放重发锁，并回滚当日次数，避免故障期消耗用户配额
      await this.redis.del(resendKey);
      await this.redis.getClient().decr(dailyKey);
      throw err;
    }
    await this.redis.set(`${scene}:${email}`, code, CODE_TTL);
    // 验证码落日志便于排查「收不到邮件」类问题；注意：能访问服务器日志即可登他人账号，稳定后建议移除
    this.logger.log(`验证码已发送：${email}（${scene}）=> ${code}`);
    return { sent: true };
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
