-- AlterTable
ALTER TABLE `user_nav_categories` ADD COLUMN `is_builtin` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `user_nav_sites` ADD COLUMN `desc` VARCHAR(191) NULL;
