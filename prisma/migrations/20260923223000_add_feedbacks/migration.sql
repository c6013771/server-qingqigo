-- 用户意见反馈表（前端「意见反馈」弹窗：功能建议 / 问题反馈 / 站点收录）
-- type/status 存小写字符串，与前端契约一致；无外键枚举约束，取值由应用层 DTO 校验
CREATE TABLE `feedbacks` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `content` VARCHAR(1000) NOT NULL,
    `contact_email` VARCHAR(100) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `reply` VARCHAR(2000) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `feedbacks_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `feedbacks` ADD CONSTRAINT `feedbacks_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
