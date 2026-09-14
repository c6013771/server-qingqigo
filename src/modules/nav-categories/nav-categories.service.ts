import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateNavCategoryDto } from './dto/create-nav-category.dto';
import { UpdateNavCategoryDto } from './dto/update-nav-category.dto';
import { CreateNavSiteDto } from './dto/create-nav-site.dto';
import { UpdateNavSiteDto } from './dto/update-nav-site.dto';
import { defaultNavCategories } from './default-categories';

/** 自定义导航分类数量上限 */
const MAX_CATEGORIES = 9;
/** 每个分类下的网站数量上限 */
const MAX_SITES_PER_CATEGORY = 9;

@Injectable()
export class NavCategoriesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async list(userId: string) {
    await this.seedBuiltinCategories(userId);
    return this.prisma.userNavCategory.findMany({
      where: { userId },
      // sortOrder 由拖插排序接口统一重写；初始数据经迁移脚本排为「内置在前」
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { sites: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    });
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
              create: cat.sites.map((s, j) => ({ ...s, sortOrder: j })),
            },
          },
        });
      }
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async createCategory(userId: string, dto: CreateNavCategoryDto) {
    const count = await this.prisma.userNavCategory.count({ where: { userId, isBuiltin: false } });
    if (count >= MAX_CATEGORIES) {
      throw new BadRequestException(`自定义分类最多只能创建 ${MAX_CATEGORIES} 个`);
    }
    // 追加到全部分类末尾（含内置副本），保证 sortOrder 连续递增
    const total = await this.prisma.userNavCategory.count({ where: { userId } });
    return this.prisma.userNavCategory.create({
      data: { ...dto, userId, sortOrder: total },
    });
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
    return { sorted: true };
  }

  async updateCategory(id: string, userId: string, dto: UpdateNavCategoryDto) {
    await this.findOwnedCategory(id, userId);
    return this.prisma.userNavCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(id: string, userId: string) {
    await this.findOwnedCategory(id, userId);
    await this.prisma.userNavCategory.delete({ where: { id } });
  }

  async createSite(categoryId: string, userId: string, dto: CreateNavSiteDto) {
    await this.findOwnedCategory(categoryId, userId);
    const count = await this.prisma.userNavSite.count({ where: { categoryId } });
    if (count >= MAX_SITES_PER_CATEGORY) {
      throw new BadRequestException(`每个分类最多只能添加 ${MAX_SITES_PER_CATEGORY} 个网站`);
    }
    return this.prisma.userNavSite.create({
      data: { ...dto, categoryId, sortOrder: count },
    });
  }

  async updateSite(categoryId: string, siteId: string, userId: string, dto: UpdateNavSiteDto) {
    await this.findOwnedSite(categoryId, siteId, userId);
    return this.prisma.userNavSite.update({ where: { id: siteId }, data: dto });
  }

  async removeSite(categoryId: string, siteId: string, userId: string) {
    await this.findOwnedSite(categoryId, siteId, userId);
    await this.prisma.userNavSite.delete({ where: { id: siteId } });
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
