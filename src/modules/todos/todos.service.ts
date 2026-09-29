import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

/** 「今日待办」数量上限 */
const MAX_TODOS = 50;

@Injectable()
export class TodosService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userTodo.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateTodoDto) {
    const count = await this.prisma.userTodo.count({ where: { userId } });
    if (count >= MAX_TODOS) {
      throw new BadRequestException(`待办最多只能添加 ${MAX_TODOS} 条`);
    }
    return this.prisma.userTodo.create({
      // 未指定排序时默认排到末尾
      data: { ...dto, userId, sortOrder: dto.sortOrder ?? count },
    });
  }

  async update(id: string, userId: string, dto: UpdateTodoDto) {
    await this.findOwned(id, userId);
    return this.prisma.userTodo.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.findOwned(id, userId);
    await this.prisma.userTodo.delete({ where: { id } });
  }

  /** 校验待办存在且属于当前用户 */
  private async findOwned(id: string, userId: string) {
    const todo = await this.prisma.userTodo.findFirst({ where: { id, userId } });
    if (!todo) throw new NotFoundException('待办不存在');
    return todo;
  }
}
