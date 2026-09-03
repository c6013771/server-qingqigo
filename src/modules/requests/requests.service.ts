import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

/** 匿名提交限流：同一 IP 每天最多 5 条 */
const ANON_DAILY_LIMIT = 5;

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(dto: CreateRequestDto, userId: string | null, ip: string) {
    if (!userId) {
      // 匿名提交：Redis 计数限流，key 按天隔离、24 小时过期
      const key = `rl:request:${this.dayKey()}:${ip}`;
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 24 * 3600);
      if (count > ANON_DAILY_LIMIT) {
        throw new HttpException(
          `提交太频繁，同一 IP 每天最多提交 ${ANON_DAILY_LIMIT} 条`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const requestNo = await this.nextRequestNo();
    return this.prisma.featureRequest.create({
      data: {
        requestNo,
        userId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        url: dto.url,
        contact: dto.contact,
      },
    });
  }

  /** 需求列表（公开），按投票数、创建时间倒序 */
  async findAll(query: QueryRequestsDto) {
    const where = query.status ? { status: query.status } : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.featureRequest.count({ where }),
      this.prisma.featureRequest.findMany({
        where,
        orderBy: [{ upvotes: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { nickname: true } } },
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items };
  }

  /** 我的需求列表（登录） */
  async findMine(userId: string, query: QueryRequestsDto) {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.featureRequest.count({ where: { userId } }),
      this.prisma.featureRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { total, page: query.page, pageSize: query.pageSize, items };
  }

  async findOne(id: string) {
    const req = await this.prisma.featureRequest.findUnique({
      where: { id },
      include: { user: { select: { nickname: true } } },
    });
    if (!req) throw new NotFoundException('需求不存在');
    return req;
  }

  /**
   * 投票/取消投票（toggle）。一人一票由 request_votes 表 (requestId, userId)
   * 唯一约束保证，upvotes 计数与投票记录在同一事务中增减。
   */
  async toggleVote(requestId: string, userId: string) {
    const req = await this.prisma.featureRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('需求不存在');

    const existing = await this.prisma.requestVote.findUnique({
      where: { requestId_userId: { requestId, userId } },
    });

    if (existing) {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.requestVote.delete({ where: { id: existing.id } }),
        this.prisma.featureRequest.update({
          where: { id: requestId },
          data: { upvotes: { decrement: 1 } },
        }),
      ]);
      return { voted: false, upvotes: updated.upvotes };
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.requestVote.create({ data: { requestId, userId } }),
      this.prisma.featureRequest.update({
        where: { id: requestId },
        data: { upvotes: { increment: 1 } },
      }),
    ]);
    return { voted: true, upvotes: updated.upvotes };
  }

  /** 管理员更新需求状态 / 备注 */
  async updateStatus(id: string, dto: UpdateStatusDto) {
    const req = await this.prisma.featureRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('需求不存在');
    return this.prisma.featureRequest.update({
      where: { id },
      data: { status: dto.status, adminNote: dto.adminNote },
    });
  }

  /**
   * 生成需求编号：QYS-YYYYMMDD-XXX
   * 当日序号用 Redis incr 原子递增，key 按天隔离并保留 48 小时防止堆积。
   */
  private async nextRequestNo(): Promise<string> {
    const day = this.dayKey();
    const key = `reqno:${day}`;
    const seq = await this.redis.incr(key);
    if (seq === 1) await this.redis.expire(key, 48 * 3600);
    return `QYS-${day}-${String(seq).padStart(3, '0')}`;
  }

  /** 本地日期 YYYYMMDD */
  private dayKey(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  }
}
