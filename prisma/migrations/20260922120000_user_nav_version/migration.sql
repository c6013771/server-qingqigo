-- 用户内置分类数据版本：用于服务端默认分类更新后的增量合并（方案：版本号 + 只加不删）
ALTER TABLE `users` ADD COLUMN `nav_version` INT NOT NULL DEFAULT 0;
