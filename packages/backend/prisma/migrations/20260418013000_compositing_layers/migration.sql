-- AlterTable
ALTER TABLE `generation_assets` ADD COLUMN `isProcessed` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `key` VARCHAR(100) NULL,
    ADD COLUMN `role` ENUM('INPUT', 'PROCESSED', 'GENERATED', 'STATIC') NOT NULL DEFAULT 'INPUT',
    ADD COLUMN `sourceAssetId` VARCHAR(36) NULL,
    MODIFY `type` ENUM('REFERENCE', 'PERSON', 'OBJECT', 'BACKGROUND', 'BACKGROUND_UI', 'EFFECT', 'LOGO', 'BADGE', 'ICON', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `generation_requests` ADD COLUMN `canvasHeight` INTEGER NOT NULL DEFAULT 720,
    ADD COLUMN `canvasWidth` INTEGER NOT NULL DEFAULT 1280,
    ADD COLUMN `renderMode` ENUM('ONE_SHOT', 'COMPOSITE') NOT NULL DEFAULT 'ONE_SHOT';

-- CreateTable
CREATE TABLE `generation_layers` (
    `id` VARCHAR(36) NOT NULL,
    `generationId` VARCHAR(36) NOT NULL,
    `variantIndex` INTEGER NULL,
    `assetId` VARCHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('BACKGROUND', 'IMAGE', 'TEXT', 'SHAPE', 'OVERLAY', 'SUBJECT', 'OBJECT', 'GLOW') NOT NULL,
    `zIndex` INTEGER NOT NULL DEFAULT 0,
    `x` DOUBLE NOT NULL DEFAULT 0,
    `y` DOUBLE NOT NULL DEFAULT 0,
    `width` DOUBLE NULL,
    `height` DOUBLE NULL,
    `opacity` DOUBLE NOT NULL DEFAULT 1.0,
    `blendMode` VARCHAR(30) NOT NULL DEFAULT 'over',
    `rotation` DOUBLE NOT NULL DEFAULT 0,
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `generation_layers_generationId_idx`(`generationId`),
    INDEX `generation_layers_assetId_idx`(`assetId`),
    INDEX `generation_layers_generationId_variantIndex_zIndex_idx`(`generationId`, `variantIndex`, `zIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `generation_assets_role_idx` ON `generation_assets`(`role`);

-- CreateIndex
CREATE INDEX `generation_assets_sourceAssetId_idx` ON `generation_assets`(`sourceAssetId`);

-- AddForeignKey
ALTER TABLE `generation_assets` ADD CONSTRAINT `generation_assets_sourceAssetId_fkey` FOREIGN KEY (`sourceAssetId`) REFERENCES `generation_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_layers` ADD CONSTRAINT `generation_layers_generationId_fkey` FOREIGN KEY (`generationId`) REFERENCES `generation_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_layers` ADD CONSTRAINT `generation_layers_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `generation_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
