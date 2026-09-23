import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeedbacksService } from './feedbacks.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('意见反馈')
@Controller('feedbacks')
export class FeedbacksController {
  constructor(private feedbacks: FeedbacksService) {}

  @ApiOperation({ summary: '提交反馈（需登录，content 10~1000 字，contact_email 选填）' })
  @ApiBearerAuth()
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateFeedbackDto, @CurrentUser() user: AuthUser) {
    return this.feedbacks.create(dto, user.id);
  }

  @ApiOperation({ summary: '我的反馈列表（需登录）' })
  @ApiBearerAuth()
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthUser) {
    return this.feedbacks.findMine(user.id);
  }
}
