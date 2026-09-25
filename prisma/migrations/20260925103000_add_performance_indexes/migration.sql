-- 性能优化：为高频「按用户/分类过滤 + 排序」查询补复合索引，
-- 避免数据量增长后走全表/半表扫描（与 schema.prisma 的 @@index 声明一一对应）

-- 我的常去：list 按 userId 过滤 + sortOrder/createdAt 排序
CREATE INDEX `user_favorites_user_id_sort_order_created_at_idx`
  ON `user_favorites`(`user_id`, `sort_order`, `created_at`);

-- 自定义导航分类：list 按 userId 过滤 + sortOrder/createdAt 排序
CREATE INDEX `user_nav_categories_user_id_sort_order_created_at_idx`
  ON `user_nav_categories`(`user_id`, `sort_order`, `created_at`);

-- 自定义导航网站：按 categoryId 过滤 + sortOrder/createdAt 排序
CREATE INDEX `user_nav_sites_category_id_sort_order_created_at_idx`
  ON `user_nav_sites`(`category_id`, `sort_order`, `created_at`);

-- 需求列表（公开）：按 status 过滤 + upvotes/createdAt 排序分页
CREATE INDEX `feature_requests_status_upvotes_created_at_idx`
  ON `feature_requests`(`status`, `upvotes`, `created_at`);

-- 我的需求列表：按 userId 过滤 + createdAt 排序分页
CREATE INDEX `feature_requests_user_id_created_at_idx`
  ON `feature_requests`(`user_id`, `created_at`);

-- 我的反馈列表：按 userId 过滤 + createdAt 排序
CREATE INDEX `feedbacks_user_id_created_at_idx`
  ON `feedbacks`(`user_id`, `created_at`);