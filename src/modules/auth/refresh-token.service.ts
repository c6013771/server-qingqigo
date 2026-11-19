import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../../redis/redis.service';

/**
 * Refresh Token：随机串存 Redis（key refresh:<token> → userId）。
 * 每次刷新即轮换：旧 token 立即作废，新 token 重新计满 TTL（滑动续期），
 * 活跃用户无需重新登录；重放旧 token 会因 key 不存在而失败。
 */
@Injectable()
export class RefreshTokenService {
  private readonly ttlSeconds: number;

  constructor(
    config: ConfigService,
    private redis: RedisService,
  ) {
    this.ttlSeconds = config.get<number>('jwt.refreshTtlSeconds', 2592000);
  }

  /** 签发新 refresh token */
  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.redis.set(`refresh:${token}`, userId, this.ttlSeconds);
    return token;
  }

  /** 轮换：旧 token 作废，签发新 token；旧 token 无效时返回 null */
  async rotate(token: string): Promise<{ userId: string; token: string } | null> {
    const userId = await this.redis.get(`refresh:${token}`);
    if (!userId) return null;
    await this.revoke(token);
    return { userId, token: await this.issue(userId) };
  }

  /** 登出吊销 */
  async revoke(token: string): Promise<void> {
    await this.redis.del(`refresh:${token}`);
  }
}
