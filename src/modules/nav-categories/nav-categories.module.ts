import { Module } from '@nestjs/common';
import { NavCategoriesController } from './nav-categories.controller';
import { NavCategoriesService } from './nav-categories.service';

@Module({
  controllers: [NavCategoriesController],
  providers: [NavCategoriesService],
})
export class NavCategoriesModule {}
