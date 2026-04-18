-- CreateTable
CREATE TABLE `reference_analyses` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `generationId` VARCHAR(36) NULL,
    `storagePath` VARCHAR(500) NULL,
    `layout` VARCHAR(50) NOT NULL,
    `personPosition` VARCHAR(50) NULL,
    `backgroundType` VARCHAR(50) NOT NULL,
    `dominantColors` JSON NOT NULL,
    `glowIntensity` VARCHAR(20) NOT NULL,
    `style` VARCHAR(50) NOT NULL,
    `hasText` BOOLEAN NOT NULL DEFAULT false,
    `textHierarchy` VARCHAR(50) NULL,
    `hasCTA` BOOLEAN NOT NULL DEFAULT false,
    `thumbnailStyle` VARCHAR(50) NOT NULL,
    `confidenceScore` DOUBLE NOT NULL DEFAULT 0.0,
    `visualHierarchy` VARCHAR(50) NULL,
    `facialEmotion` VARCHAR(50) NULL,
    `secondaryColor` VARCHAR(20) NULL,
    `lightingStyle` VARCHAR(50) NULL,
    `depth` VARCHAR(20) NULL,
    `visualDensity` VARCHAR(20) NULL,
    `legibilityScore` INTEGER NULL,
    `visualEnergy` VARCHAR(20) NULL,
    `semanticTheme` VARCHAR(100) NULL,
    `textSafeZone` VARCHAR(20) NULL,
    `detectedObjects` JSON NULL,
    `subjectScale` VARCHAR(20) NULL,
    `styleKeywords` JSON NULL,
    `objectsPosition` JSON NULL,
    `rawJson` JSON NOT NULL,
    `modelUsed` VARCHAR(100) NOT NULL DEFAULT 'gpt-4o',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reference_analyses_tenantId_idx`(`tenantId`),
    INDEX `reference_analyses_generationId_idx`(`generationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edit_operations` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `sourceGenerationId` VARCHAR(36) NOT NULL,
    `baseVariantId` VARCHAR(36) NULL,
    `resultGenerationId` VARCHAR(36) NULL,
    `status` ENUM('DRAFT', 'COMMITTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `promptText` TEXT NOT NULL,
    `preserveList` JSON NOT NULL,
    `changeSet` JSON NOT NULL,
    `promptDelta` JSON NOT NULL,
    `previewSummary` VARCHAR(500) NOT NULL,
    `appliedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `edit_operations_tenantId_idx`(`tenantId`),
    INDEX `edit_operations_sourceGenerationId_idx`(`sourceGenerationId`),
    INDEX `edit_operations_resultGenerationId_idx`(`resultGenerationId`),
    INDEX `edit_operations_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `export_jobs` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `variantId` VARCHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `options` JSON NOT NULL,
    `outputPath` VARCHAR(500) NULL,
    `outputUrl` VARCHAR(500) NULL,
    `fileSizeBytes` INTEGER NULL,
    `errorMessage` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `export_jobs_tenantId_idx`(`tenantId`),
    INDEX `export_jobs_variantId_idx`(`variantId`),
    INDEX `export_jobs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `template_layers` (
    `id` VARCHAR(36) NOT NULL,
    `templateId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('BACKGROUND', 'IMAGE', 'TEXT', 'SHAPE', 'OVERLAY', 'SUBJECT', 'OBJECT', 'GLOW') NOT NULL,
    `zIndex` INTEGER NOT NULL DEFAULT 0,
    `x` DOUBLE NOT NULL DEFAULT 0,
    `y` DOUBLE NOT NULL DEFAULT 0,
    `width` DOUBLE NULL,
    `height` DOUBLE NULL,
    `opacity` DOUBLE NOT NULL DEFAULT 1.0,
    `blendMode` VARCHAR(30) NOT NULL DEFAULT 'normal',
    `isVisible` BOOLEAN NOT NULL DEFAULT true,
    `isLocked` BOOLEAN NOT NULL DEFAULT false,
    `config` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `template_layers_templateId_idx`(`templateId`),
    INDEX `template_layers_zIndex_idx`(`zIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `template_layers` ADD CONSTRAINT `template_layers_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
