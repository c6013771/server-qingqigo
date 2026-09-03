import { PartialType } from '@nestjs/swagger';
import { CreateFavoriteDto } from './create-favorite.dto';

// 使用 @nestjs/swagger 的 PartialType，文档中自动继承字段标注并标记为可选
export class UpdateFavoriteDto extends PartialType(CreateFavoriteDto) {}
