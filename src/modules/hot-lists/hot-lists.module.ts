import { Module } from '@nestjs/common';
import { HotListsController } from './hot-lists.controller';
import { HotListsService } from './hot-lists.service';

@Module({
  controllers: [HotListsController],
  providers: [HotListsService],
})
export class HotListsModule {}
