import { Body, Controller, Get, Ip, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { QueryRequestsDto } from './dto/query-requests.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('需求建议')
@Controller('requests')
export class RequestsController {
  constructor(private requests: RequestsService) {}

  /** 提交需求：支持匿名（走 IP 限流）与登录用户 */
  @ApiOperation({ summary: '提交需求（支持匿名，可选登录；匿名按 IP 限流 5 条/天）' })
  @ApiBearerAuth()
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: AuthUser | null, @Ip() ip: string) {
    return this.requests.create(dto, user?.id ?? null, ip);
  }

  /** 需求列表（公开） */
  @ApiOperation({ summary: '需求列表（分页，可按 status 过滤）' })
  @Get()
  findAll(@Query() query: QueryRequestsDto) {
    return this.requests.findAll(query);
  }

  /** 我的需求（登录）。注意须声明在 ':id' 之前 */
  @ApiOperation({ summary: '我的需求列表' })
  @ApiBearerAuth()
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: AuthUser, @Query() query: QueryRequestsDto) {
    return this.requests.findMine(user.id, query);
  }

  @ApiOperation({ summary: '需求详情' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requests.findOne(id);
  }

  /** 点赞 / 取消点赞（登录，toggle） */
  @ApiOperation({ summary: '点赞 / 取消点赞（toggle）' })
  @ApiBearerAuth()
  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  vote(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.requests.toggleVote(id, user.id);
  }

  /** 管理员修改需求状态 */
  @ApiOperation({ summary: '管理员修改需求状态' })
  @ApiBearerAuth()
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.requests.updateStatus(id, dto);
  }
}
