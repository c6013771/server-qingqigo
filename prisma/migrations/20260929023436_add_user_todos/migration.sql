-- AlterTable
ALTER TABLE `feedbacks` ALTER COLUMN `updated_at` DROP DEFAULT;

-- CreateTable
CREATE TABLE `user_todos` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `content` VARCHAR(200) NOT NULL,
    `done` BOOLEAN NOT NULL DEFAULT false,
    `date` VARCHAR(10) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `user_todos_user_id_sort_order_created_at_idx`(`user_id`, `sort_order`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_todos` ADD CONSTRAINT `user_todos_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
