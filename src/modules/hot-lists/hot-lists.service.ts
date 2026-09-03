import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { HotSource } from './dto/query-hot-list.dto';

/** 缓存 10 分钟 */
const CACHE_TTL = 600;

const SOURCE_NAMES: Record<HotSource, string> = {
  zhihu: '知乎',
  weibo: '微博',
  baidu: '百度',
};

@Injectable()
export class HotListsService {
  constructor(private redis: RedisService) {}

  /** 热榜数据：优先读 Redis 缓存，未命中则返回 mock 数据并写入缓存 */
  async getHotList(source: HotSource) {
    const key = `hotlist:${source}`;
    const cached = await this.redis.get(key);
    if (cached) {
      return { source, cached: true, items: JSON.parse(cached) };
    }

    // TODO: 接入真实热榜抓取逻辑（知乎/微博/百度），可对接第三方聚合 API 或自建爬虫服务
    const items = this.mockItems(source);
    await this.redis.set(key, JSON.stringify(items), CACHE_TTL);
    return { source, cached: false, items };
  }

  private mockItems(source: HotSource) {
    return Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      title: `${SOURCE_NAMES[source]}热榜示例 ${i + 1}`,
      url: 'https://example.com',
      hot: 1000000 - i * 50000,
    }));
  }
}
