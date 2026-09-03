import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * ioredis 简单封装：get / set / del / incr / expire
 * 用于热榜缓存、需求提交 IP 限流、需求编号自增、验证码缓存等场景。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('redis.host', '127.0.0.1'),
      port: config.get<number>('redis.port', 6379),
      password: config.get<string>('redis.password') || undefined,
      lazyConnect: true,
      // Redis 未启动时快速失败，避免请求长时间挂起
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  /** 需要原生能力（如 pipeline）时可直接取用 */
  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /** ttlSeconds 不传则永不过期 */
  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    if (ttlSeconds) return this.client.set(key, value, 'EX', ttlSeconds);
    return this.client.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }
}
