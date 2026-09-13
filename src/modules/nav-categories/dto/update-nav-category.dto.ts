import { PartialType } from '@nestjs/swagger';
import { CreateNavCategoryDto } from './create-nav-category.dto';

export class UpdateNavCategoryDto extends PartialType(CreateNavCategoryDto) {}
