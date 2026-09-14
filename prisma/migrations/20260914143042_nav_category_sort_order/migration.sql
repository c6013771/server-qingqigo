-- 排序规则从「内置在前 + sortOrder」改为纯 sortOrder 后，
-- 需把存量数据的 sort_order 按原有展示顺序（内置在前，其次 sortOrder、创建时间）重写为连续序号，
-- 避免自定义分类（原 sortOrder 从 0 起）与内置副本交错。
UPDATE user_nav_categories c
JOIN (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id
           ORDER BY is_builtin DESC, sort_order ASC, created_at ASC
         ) - 1 AS new_order
  FROM user_nav_categories
) r ON c.id = r.id
SET c.sort_order = r.new_order;
