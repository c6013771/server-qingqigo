-- 待办状态升级：done 布尔值 → status 三态（doing / done / cancelled）

-- 新增 status 字段
ALTER TABLE `user_todos` ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'doing' AFTER `done`;

-- 迁移存量数据：已完成 → done
UPDATE `user_todos` SET `status` = 'done' WHERE `done` = true;

-- 删除旧 done 字段
ALTER TABLE `user_todos` DROP COLUMN `done`;
