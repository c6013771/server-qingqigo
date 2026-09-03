import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';

/** 「我的常去」数量上限 */
const MAX_FAVORITES = 18;

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userFavorite.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateFavoriteDto) {
    const count = await this.prisma.userFavorite.count({ where: { userId } });
    if (count >= MAX_FAVORITES) {
      throw new BadRequestException(`常去网站最多只能添加 ${MAX_FAVORITES} 个`);
    }
    return this.prisma.userFavorite.create({
      // 未指定排序时默认排到末尾
      data: { ...dto, userId, sortOrder: dto.sortOrder ?? count },
    });
  }

  async update(id: string, userId: string, dto: UpdateFavoriteDto) {
    await this.findOwned(id, userId);
    return this.prisma.userFavorite.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);
    await this.prisma.userFavorite.delete({ where: { id } });
  }

  /** 校验收藏存在且属于当前用户 */
  private async findOwned(id: string, userId: string) {
    const fav = await this.prisma.userFavorite.findFirst({ where: { id, userId } });
    if (!fav) throw new NotFoundException('收藏不存在');
    return fav;
  }
}
