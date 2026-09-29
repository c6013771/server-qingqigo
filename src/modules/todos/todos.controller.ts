import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

/** 今日待办：全部接口需登录，且只能操作自己的数据 */
@ApiTags('今日待办')
@ApiBearerAuth()
@Controller('todos')
@UseGuards(JwtAuthGuard)
export class TodosController {
  constructor(private todos: TodosService) {}

  @ApiOperation({ summary: '待办列表' })
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.todos.list(user.id);
  }

  @ApiOperation({ summary: '添加待办（最多 50 条）' })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTodoDto) {
    return this.todos.create(user.id, dto);
  }

  @ApiOperation({ summary: '修改待办' })
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTodoDto) {
    return this.todos.update(id, user.id, dto);
  }

  @ApiOperation({ summary: '删除待办' })
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.todos.remove(id, user.id);
  }
}
