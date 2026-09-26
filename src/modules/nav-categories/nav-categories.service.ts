import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateNavCategoryDto } from './dto/create-nav-category.dto';
import { UpdateNavCategoryDto } from './dto/update-nav-category.dto';
import { CreateNavSiteDto } from './dto/create-nav-site.dto';
import { UpdateNavSiteDto } from './dto/update-nav-site.dto';
import { defaultNavCategories, NAV_DEFAULTS_VERSION } from './default-categories';

/** 自定义导航分类数量上限 */
const MAX_CATEGORIES = 16;
/** 每个分类下的网站数量上限 */
const MAX_SITES_PER_CATEGORY = 16;
/** 导航列表缓存 5 分钟：数据个人化且写操作主动失效，命中可完全绕过 DB */
const LIST_CACHE_TTL = 300;
/** 导航列表缓存键 */
const listCacheKey = (userId: string) => `nav:list:${userId}`;

@Injectable()
export class NavCategoriesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async list(userId: string) {
    // 优先读缓存：首页高频接口，命中直接返回，省去 seed/merge/findMany 全部 DB 与 Redis 往返
    try {
      const cached = await this.redis.get(listCacheKey(userId));
      if (cached) return JSON.parse(cached);
    } catch {
      // Redis 不可用则走 DB，不影响主流程
    }

    await this.seedBuiltinCategories(userId);
    await this.mergeBuiltinUpdates(userId);
    const data = await this.prisma.userNavCategory.findMany({
      where: { userId },
      // sortOrder 由拖插排序接口统一重写；初始数据经迁移脚本排为「内置在前」
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { sites: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    });
    try {
      await this.redis.set(listCacheKey(userId), JSON.stringify(data), LIST_CACHE_TTL);
    } catch {
      // 缓存失败不影响返回
    }
    return data;
  }

  /** 写操作后使列表缓存失效，保证下一次 list 拉取到最新数据 */
  private async invalidateCache(userId: string): Promise<void> {
    try {
      await this.redis.del(listCacheKey(userId));
    } catch {
      // 忽略缓存失效失败
    }
  }

  /**
   * 首次拉取时把系统内置分类初始化为用户自己的副本（之后可自由编辑/删除）。
   * 仅当用户名下没有任何分类时播种，避免用户删光内置分类后被重复种回；
   * Redis NX 锁防并发首次请求重复播种。
   */
  private async seedBuiltinCategories(userId: string): Promise<void> {
    const lockKey = `nav:seed:${userId}`;
    const locked = await this.redis.getClient().set(lockKey, '1', 'EX', 30, 'NX');
    if (!locked) {
      // 并发的其他请求正在播种：最多等 3 秒让其完成，避免首次并发拉取返回空列表
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const count = await this.prisma.userNavCategory.count({ where: { userId } });
        if (count > 0) break;
      }
      return;
    }
    try {
      const count = await this.prisma.userNavCategory.count({ where: { userId } });
      if (count > 0) return;
      for (const [i, cat] of defaultNavCategories.entries()) {
        await this.prisma.userNavCategory.create({
          data: {
            userId,
            label: cat.label,
            isBuiltin: true,
            sortOrder: i,
            sites: {
              create: cat.sites.map((s, j) => ({ name: s.name, url: s.url, desc: s.desc, sortOrder: j })),
            },
          },
        });
      }
      await this.prisma.user.update({ where: { id: userId }, data: { navVersion: NAV_DEFAULTS_VERSION } });
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * 内置分类的增量合并（只加不删）：
   * 服务端默认数据版本高于用户 navVersion 时，把 since > 用户版本的新分类整个补入、
   * 新网站补进同名内置分类；用户的重命名/删除/排序/自定义一律不动。
   * 合并失败不影响列表返回，下次请求会重试。
   */
  private async mergeBuiltinUpdates(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { navVersion: true } });
    const userVersion = user?.navVersion ?? 0;
    if (userVersion >= NAV_DEFAULTS_VERSION) return;

    const lockKey = `nav:merge:${userId}`;
    const locked = await this.redis.getClient().set(lockKey, '1', 'EX', 30, 'NX');
    if (!locked) return; // 并发请求正在合并，本次跳过（数据最终一致）
    try {
      const builtinCats = await this.prisma.userNavCategory.findMany({
        where: { userId, isBuiltin: true },
        include: { sites: { select: { url: true } } },
      });
      let sortOrder = await this.prisma.userNavCategory.count({ where: { userId } });

      for (const cat of defaultNavCategories) {
        const catSince = cat.since ?? 0;
        const existing = builtinCats.find((c) => c.label === cat.label);

        // 新增分类：用户没有同名内置分类才补入（用户主动删过的旧分类 since 低，不会复活）
        if (!existing) {
          if (catSince <= userVersion) continue;
          await this.prisma.userNavCategory.create({
            data: {
              userId,
              label: cat.label,
              isBuiltin: true,
              sortOrder: sortOrder++,
              sites: { create: cat.sites.map((s, j) => ({ name: s.name, url: s.url, desc: s.desc, sortOrder: j })) },
            },
          });
          continue;
        }

        // 已有分类：只补 since 高于用户版本、且用户没有同 URL 的网站
        const existingUrls = new Set(existing.sites.map((s) => s.url));
        const newSites = cat.sites.filter((s) => (s.since ?? 0) > userVersion && !existingUrls.has(s.url));
        if (!newSites.length) continue;
        let siteOrder = await this.prisma.userNavSite.count({ where: { categoryId: existing.id } });
        for (const s of newSites) {
          await this.prisma.userNavSite.create({
            data: { categoryId: existing.id, name: s.name, url: s.url, desc: s.desc, sortOrder: siteOrder++ },
          });
        }
      }

      await this.prisma.user.update({ where: { id: userId }, data: { navVersion: NAV_DEFAULTS_VERSION } });
    } catch {
      // 合并失败下次列表请求重试，不阻断本次返回
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /** 恢复内置分类为当前默认数据：删除全部内置副本后重新播种，自定义分类不动 */
  async resetBuiltinCategories(userId: string) {
    await this.prisma.userNavCategory.deleteMany({ where: { userId, isBuiltin: true } });
    const customs = await this.prisma.userNavCategory.findMany({ where: { userId }, select: { id: true } });
    // 自定义分类的顺序往前顺移，内置分类重新从 0 排
    for (const [i, c] of customs.entries()) {
      await this.prisma.userNavCategory.update({ where: { id: c.id }, data: { sortOrder: i } });
    }
    for (const [i, cat] of defaultNavCategories.entries()) {
      await this.prisma.userNavCategory.create({
        data: {
          userId,
          label: cat.label,
          isBuiltin: true,
          sortOrder: customs.length + i,
          sites: { create: cat.sites.map((s, j) => ({ name: s.name, url: s.url, desc: s.desc, sortOrder: j })) },
        },
      });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { navVersion: NAV_DEFAULTS_VERSION } });
    await this.invalidateCache(userId);
    return this.list(userId);
  }

  async createCategory(userId: string, dto: CreateNavCategoryDto) {
    const count = await this.prisma.userNavCategory.count({ where: { userId, isBuiltin: false } });
    if (count >= MAX_CATEGORIES) {
      throw new BadRequestException(`自定义分类最多只能创建 ${MAX_CATEGORIES} 个`);
    }
    // 追加到全部分类末尾（含内置副本），保证 sortOrder 连续递增
    const total = await this.prisma.userNavCategory.count({ where: { userId } });
    const created = await this.prisma.userNavCategory.create({
      data: { ...dto, userId, sortOrder: total },
    });
    await this.invalidateCache(userId);
    return created;
  }

  /** 拖插排序：按提交的 id 顺序重写 sortOrder；要求提交的 id 恰好是用户的全部分类 */
  async updateOrder(userId: string, ids: string[]) {
    const owned = await this.prisma.userNavCategory.findMany({ where: { userId }, select: { id: true } });
    const ownedIds = new Set(owned.map((c) => c.id));
    if (ids.length !== ownedIds.size || ids.some((id) => !ownedIds.has(id))) {
      throw new BadRequestException('排序数据与当前分类不一致，请刷新后重试');
    }
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.userNavCategory.update({ where: { id }, data: { sortOrder: i } })),
    );
    await this.invalidateCache(userId);
    return { sorted: true };
  }

  async updateCategory(id: string, userId: string, dto: UpdateNavCategoryDto) {
    await this.findOwnedCategory(id, userId);
    const updated = await this.prisma.userNavCategory.update({ where: { id }, data: dto });
    await this.invalidateCache(userId);
    return updated;
  }

  async removeCategory(id: string, userId: string) {
    await this.findOwnedCategory(id, userId);
    await this.prisma.userNavCategory.delete({ where: { id } });
    await this.invalidateCache(userId);
  }

  async createSite(categoryId: string, userId: string, dto: CreateNavSiteDto) {
    await this.findOwnedCategory(categoryId, userId);
    const count = await this.prisma.userNavSite.count({ where: { categoryId } });
    if (count >= MAX_SITES_PER_CATEGORY) {
      throw new BadRequestException(`每个分类最多只能添加 ${MAX_SITES_PER_CATEGORY} 个网站`);
    }
    const created = await this.prisma.userNavSite.create({
      data: { ...dto, categoryId, sortOrder: count },
    });
    await this.invalidateCache(userId);
    return created;
  }

  async updateSite(categoryId: string, siteId: string, userId: string, dto: UpdateNavSiteDto) {
    await this.findOwnedSite(categoryId, siteId, userId);
    const updated = await this.prisma.userNavSite.update({ where: { id: siteId }, data: dto });
    await this.invalidateCache(userId);
    return updated;
  }

  async removeSite(categoryId: string, siteId: string, userId: string) {
    await this.findOwnedSite(categoryId, siteId, userId);
    await this.prisma.userNavSite.delete({ where: { id: siteId } });
    await this.invalidateCache(userId);
  }

  /** 校验分类存在且属于当前用户 */
  private async findOwnedCategory(id: string, userId: string) {
    const cat = await this.prisma.userNavCategory.findFirst({ where: { id, userId } });
    if (!cat) throw new NotFoundException('分类不存在');
    return cat;
  }

  /** 校验网站存在，且其分类属于当前用户 */
  private async findOwnedSite(categoryId: string, siteId: string, userId: string) {
    await this.findOwnedCategory(categoryId, userId);
    const site = await this.prisma.userNavSite.findFirst({ where: { id: siteId, categoryId } });
    if (!site) throw new NotFoundException('网站不存在');
    return site;
  }
}
