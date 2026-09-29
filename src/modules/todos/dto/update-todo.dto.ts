import { PartialType } from '@nestjs/swagger';
import { CreateTodoDto } from './create-todo.dto';

// 使用 @nestjs/swagger 的 PartialType，文档中自动继承字段标注并标记为可选
export class UpdateTodoDto extends PartialType(CreateTodoDto) {}
