import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Response } from 'express';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../users/users.service';

/** 一次性登录凭证 ticket 的有效期（秒） */
const TICKET_TTL = 300;
/** 授权 state 防 CSRF 的有效期（秒） */
const STATE_TTL = 600;

/** 微信 access_token 接口返回 */
interface WechatTokenResponse {
  access_token?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

/** 微信用户信息接口返回 */
interface WechatUserInfo {
  openid?: string;
  nickname?: string;
  headimgurl?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * 微信开放平台「网站应用」扫码登录。
 * 流程：authorize-url 生成微信二维码地址 → 用户扫码授权 →
 * 微信回调 /auth/wechat/callback（携 code + state）→ 换取 openid、查建用户、
 * 签发一次性 ticket 并以 302 跳回前端回调页 → 前端凭 ticket 调 /auth/wechat/login 换 JWT。
 */
@Injectable()
export class WechatService {
  constructor(
    private config: ConfigService,
    private users: UsersService,
    private jwt: JwtService,
    private redis: RedisService,
  ) {}

  /** 生成微信扫码授权地址（附带随机 state 防 CSRF） */
  async buildAuthorizeUrl(): Promise<{ url: string }> {
    const appId = this.config.get<string>('wechat.appId', '');
    const redirectUri = this.config.get<string>('wechat.redirectUri', '');
    this.assertConfigured(appId, redirectUri);

    const state = randomBytes(16).toString('hex');
    // state 先写入 Redis，回调时校验通过即作废，防止跨站登录伪造
    await this.redis.set(`wechat:state:${state}`, '1', STATE_TTL);

    const url =
      'https://open.weixin.qq.com/connect/qrconnect?' +
      new URLSearchParams({
        appid: appId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'snsapi_login',
        state,
      }).toString() +
      '#wechat_redirect';

    return { url };
  }

  /**
   * 处理微信授权回调：校验 state、换 token/openid、查建用户、签发 ticket，
   * 最后 302 跳转到前端回调页。错误时也跳回前端回调页并附带 error 提示。
   */
  async handleCallback(code: string, state: string, res: Response): Promise<void> {
    const frontendCallback = this.config.get<string>('wechat.frontendCallback', '');

    const fail = (message: string) => {
      const target = new URL(frontendCallback || 'about:blank');
      target.searchParams.set('error', message);
      res.redirect(target.toString());
    };

    // state 校验：不存在或已使用则拒绝，防止 CSRF
    if (!state || !(await this.redis.del(`wechat:state:${state}`))) {
      fail('微信登录校验失败，请重新扫码');
      return;
    }

    if (!code) {
      fail('未获取到微信授权，请重试');
      return;
    }

    const tokenRes = await this.fetchAccessToken(code);
    if (!tokenRes.access_token || !tokenRes.openid) {
      fail('微信登录失败，请重试');
      return;
    }

    const userInfo = await this.fetchUserInfo(tokenRes.access_token, tokenRes.openid);

    const user = await this.ensureUser(tokenRes.openid, userInfo);

    // 用一次性 ticket 承载 JWT，避免把 token 直接放在重定向 URL 里
    const ticket = randomBytes(16).toString('hex');
    const auth = this.buildAuthResult(user);
    await this.redis.set(`wechat:ticket:${ticket}`, JSON.stringify(auth), TICKET_TTL);

    const target = new URL(frontendCallback || 'about:blank');
    target.searchParams.set('ticket', ticket);
    res.redirect(target.toString());
  }

  /** 前端凭一次性 ticket 换取 JWT 与用户信息；ticket 读取后立即作废 */
  async loginWithTicket(ticket: string) {
    const key = `wechat:ticket:${ticket}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new BadRequestException('登录凭证已失效，请重新扫码');

    await this.redis.del(key);
    try {
      return JSON.parse(raw);
    } catch {
      throw new BadRequestException('登录凭证无效，请重新扫码');
    }
  }

  /** 用 code 换取 access_token 与 openid */
  private async fetchAccessToken(code: string): Promise<WechatTokenResponse> {
    const appId = this.config.get<string>('wechat.appId', '');
    const appSecret = this.config.get<string>('wechat.appSecret', '');

    const url = 'https://api.weixin.qq.com/sns/oauth2/access_token?' + new URLSearchParams({
      appid: appId,
      secret: appSecret,
      code,
      grant_type: 'authorization_code',
    }).toString();

    try {
      const res = await fetch(url);
      const data = (await res.json()) as WechatTokenResponse;
      if (!res.ok || data.errcode) {
        console.error('微信换取 access_token 失败:', data);
        return {};
      }
      return data;
    } catch (err) {
      console.error('微信换取 access_token 异常:', err);
      return {};
    }
  }

  /** 拉取微信用户昵称与头像 */
  private async fetchUserInfo(accessToken: string, openid: string): Promise<WechatUserInfo> {
    const url = 'https://api.weixin.qq.com/sns/userinfo?' + new URLSearchParams({
      access_token: accessToken,
      openid,
      lang: 'zh_CN',
    }).toString();

    try {
      const res = await fetch(url);
      const data = (await res.json()) as WechatUserInfo;
      if (!res.ok || data.errcode) {
        console.error('微信拉取用户信息失败:', data);
        return {};
      }
      return data;
    } catch (err) {
      console.error('微信拉取用户信息异常:', err);
      return {};
    }
  }

  /** 按 openid 查找用户，不存在则创建；返回用户记录 */
  private async ensureUser(openid: string, info: WechatUserInfo) {
    const existing = await this.users.findByWxOpenid(openid);
    if (existing) {
      await this.users.touchLastLogin(existing.id);
      return existing;
    }

    const created = await this.users.createWithWechat({
      wxOpenid: openid,
      nickname: info.nickname || undefined,
      avatarUrl: info.headimgurl || undefined,
    });
    await this.users.touchLastLogin(created.id);
    return created;
  }

  /** 签发 JWT 并返回基础用户信息（与邮箱登录返回结构保持一致） */
  private buildAuthResult(user: { id: string; email: string | null; nickname: string | null; role: string; avatarUrl: string | null }) {
    const token = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private assertConfigured(appId: string, redirectUri: string) {
    if (!appId || !redirectUri) {
      throw new BadRequestException('微信登录尚未配置，请联系管理员');
    }
  }
}