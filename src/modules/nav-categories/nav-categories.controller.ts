import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NavCategoriesService } from './nav-categories.service';
import { CreateNavCategoryDto } from './dto/create-nav-category.dto';
import { UpdateNavCategoryDto } from './dto/update-nav-category.dto';
import { CreateNavSiteDto } from './dto/create-nav-site.dto';
import { UpdateNavSiteDto } from './dto/update-nav-site.dto';
import { ReorderNavCategoriesDto } from './dto/reorder-nav-categories.dto';

/** 自定义导航分类：全部接口需登录，且只能操作自己的数据 */
@ApiTags('自定义导航分类')
@ApiBearerAuth()
@Controller('nav-categories')
@UseGuards(JwtAuthGuard)
export class NavCategoriesController {
  constructor(private navCategories: NavCategoriesService) {}

  @ApiOperation({ summary: '自定义分类列表（含分类下的网站）' })
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.navCategories.list(user.id);
  }

  @ApiOperation({ summary: '新建分类（最多 9 个）' })
  @Post()
  createCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateNavCategoryDto) {
    return this.navCategories.createCategory(user.id, dto);
  }

  @ApiOperation({ summary: '恢复默认分类导航：重置内置分类副本为当前默认数据' })
  @Post('reset-builtin')
  resetBuiltin(@CurrentUser() user: AuthUser) {
    return this.navCategories.resetBuiltinCategories(user.id);
  }

  // 注意：必须在 @Patch(':id') 之前声明，否则 order 会被当作 :id 匹配
  @ApiOperation({ summary: '拖拽排序：按提交顺序重排全部分类' })
  @Patch('order')
  updateOrder(@CurrentUser() user: AuthUser, @Body() dto: ReorderNavCategoriesDto) {
    return this.navCategories.updateOrder(user.id, dto.ids);
  }

  @ApiOperation({ summary: '重命名分类' })
  @Patch(':id')
  updateCategory(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateNavCategoryDto) {
    return this.navCategories.updateCategory(id, user.id, dto);
  }

  @ApiOperation({ summary: '删除分类（级联删除分类下的网站）' })
  @Delete(':id')
  removeCategory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.navCategories.removeCategory(id, user.id);
  }

  @ApiOperation({ summary: '分类下添加网站（每个分类最多 9 个）' })
  @Post(':id/sites')
  createSite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateNavSiteDto) {
    return this.navCategories.createSite(id, user.id, dto);
  }

  @ApiOperation({ summary: '编辑分类下的网站' })
  @Patch(':id/sites/:siteId')
  updateSite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('siteId') siteId: string,
    @Body() dto: UpdateNavSiteDto,
  ) {
    return this.navCategories.updateSite(id, siteId, user.id, dto);
  }

  @ApiOperation({ summary: '删除分类下的网站' })
  @Delete(':id/sites/:siteId')
  removeSite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('siteId') siteId: string) {
    return this.navCategories.removeSite(id, siteId, user.id);
  }
}
