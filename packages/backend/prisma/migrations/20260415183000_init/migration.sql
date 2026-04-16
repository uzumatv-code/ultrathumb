-- CreateTable
CREATE TABLE `tenants` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `logoUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `tenants_slug_key`(`slug`),
    INDEX `tenants_status_idx`(`status`),
    INDEX `tenants_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPERADMIN', 'ADMIN', 'USER', 'VIEWER') NOT NULL DEFAULT 'USER',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION') NOT NULL DEFAULT 'ACTIVE',
    `avatarUrl` VARCHAR(500) NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `emailVerifyToken` VARCHAR(255) NULL,
    `passwordResetToken` VARCHAR(255) NULL,
    `passwordResetExpiresAt` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `referralCode` VARCHAR(20) NULL,
    `referredByUserId` VARCHAR(36) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_referralCode_key`(`referralCode`),
    INDEX `users_tenantId_idx`(`tenantId`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_status_idx`(`status`),
    UNIQUE INDEX `users_tenantId_email_key`(`tenantId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `sessionId` VARCHAR(36) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_tokenHash_key`(`tokenHash`),
    INDEX `refresh_tokens_userId_idx`(`userId`),
    INDEX `refresh_tokens_sessionId_idx`(`sessionId`),
    INDEX `refresh_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NOT NULL,
    `priceCents` INTEGER NOT NULL,
    `generationsLimit` INTEGER NOT NULL DEFAULT 30,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `features` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `plans_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `planId` VARCHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'TRIAL', 'PENDING') NOT NULL DEFAULT 'PENDING',
    `currentPeriodStart` DATETIME(3) NOT NULL,
    `currentPeriodEnd` DATETIME(3) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancellationReason` VARCHAR(500) NULL,
    `trialEndsAt` DATETIME(3) NULL,
    `mpSubscriptionId` VARCHAR(100) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `subscriptions_tenantId_idx`(`tenantId`),
    INDEX `subscriptions_status_idx`(`status`),
    INDEX `subscriptions_currentPeriodEnd_idx`(`currentPeriodEnd`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_providers` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('OPENAI', 'STABILITY', 'REPLICATE', 'CUSTOM') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isFallback` BOOLEAN NOT NULL DEFAULT false,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `generationModel` VARCHAR(100) NOT NULL,
    `visionModel` VARCHAR(100) NULL,
    `maxTokens` INTEGER NOT NULL DEFAULT 4096,
    `timeoutMs` INTEGER NOT NULL DEFAULT 120000,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `costPer1kTokens` DECIMAL(10, 6) NOT NULL,
    `costPerImage` DECIMAL(10, 6) NOT NULL,
    `encryptedApiKey` TEXT NOT NULL,
    `encryptedOrgId` TEXT NULL,
    `additionalConfig` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_providers_isActive_idx`(`isActive`),
    INDEX `ai_providers_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `templates` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `category` ENUM('GAMER_FPS', 'BATTLE_ROYALE', 'MOBILE_GAME', 'UNBOXING', 'REACTION', 'TUTORIAL', 'CLICKBAIT_ENERGY', 'CLEAN_MINIMAL', 'CINEMATIC', 'CUSTOM') NOT NULL,
    `previewImageUrl` VARCHAR(500) NULL,
    `demoImageUrl` VARCHAR(500) NULL,
    `isPremium` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isSystemTemplate` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `defaultStyleConfig` JSON NOT NULL,
    `defaultPromptHints` TEXT NULL,
    `recommendedFonts` JSON NULL,
    `tags` JSON NOT NULL,
    `currentVersionId` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `templates_category_idx`(`category`),
    INDEX `templates_isActive_idx`(`isActive`),
    INDEX `templates_isPremium_idx`(`isPremium`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `template_versions` (
    `id` VARCHAR(36) NOT NULL,
    `templateId` VARCHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `changeDescription` TEXT NULL,
    `styleConfig` JSON NOT NULL,
    `promptHints` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(36) NULL,

    INDEX `template_versions_templateId_idx`(`templateId`),
    UNIQUE INDEX `template_versions_templateId_version_key`(`templateId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_saved_models` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(500) NULL,
    `type` ENUM('MODEL', 'PRESET', 'STYLE') NOT NULL,
    `previewImageUrl` VARCHAR(500) NULL,
    `styleConfig` JSON NOT NULL,
    `promptHints` TEXT NULL,
    `referenceAssetId` VARCHAR(36) NULL,
    `isFavorite` BOOLEAN NOT NULL DEFAULT false,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `user_saved_models_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `user_saved_models_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_requests` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `templateId` VARCHAR(36) NULL,
    `savedModelId` VARCHAR(36) NULL,
    `aiProviderId` VARCHAR(36) NULL,
    `status` ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `freeTextPrompt` TEXT NULL,
    `styleConfig` JSON NOT NULL,
    `structuredPromptJson` JSON NULL,
    `referenceAnalysis` JSON NULL,
    `finalPromptUsed` TEXT NULL,
    `errorMessage` TEXT NULL,
    `errorCode` VARCHAR(50) NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `queueJobId` VARCHAR(255) NULL,
    `queuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `estimatedCostCents` INTEGER NULL,
    `actualCostCents` INTEGER NULL,
    `tokensUsed` INTEGER NULL,
    `modelUsed` VARCHAR(100) NULL,
    `durationMs` INTEGER NULL,
    `quotaCounted` BOOLEAN NOT NULL DEFAULT true,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `generation_requests_tenantId_idx`(`tenantId`),
    INDEX `generation_requests_userId_idx`(`userId`),
    INDEX `generation_requests_status_idx`(`status`),
    INDEX `generation_requests_createdAt_idx`(`createdAt`),
    INDEX `generation_requests_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_variants` (
    `id` VARCHAR(36) NOT NULL,
    `generationId` VARCHAR(36) NOT NULL,
    `variantIndex` INTEGER NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'PAID', 'AVAILABLE', 'EXPIRED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `hdStoragePath` VARCHAR(500) NULL,
    `previewStoragePath` VARCHAR(500) NULL,
    `thumbnailStoragePath` VARCHAR(500) NULL,
    `previewUrl` VARCHAR(500) NULL,
    `thumbnailUrl` VARCHAR(500) NULL,
    `templateAdherenceScore` INTEGER NULL,
    `textReadabilityScore` INTEGER NULL,
    `visualImpactScore` INTEGER NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `paidAt` DATETIME(3) NULL,
    `revisedPrompt` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `generation_variants_generationId_idx`(`generationId`),
    INDEX `generation_variants_status_idx`(`status`),
    INDEX `generation_variants_isPaid_idx`(`isPaid`),
    UNIQUE INDEX `generation_variants_generationId_variantIndex_key`(`generationId`, `variantIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_assets` (
    `id` VARCHAR(36) NOT NULL,
    `generationId` VARCHAR(36) NOT NULL,
    `type` ENUM('REFERENCE', 'PERSON', 'OBJECT', 'BACKGROUND', 'LOGO', 'BADGE', 'ICON', 'OTHER') NOT NULL,
    `originalFilename` VARCHAR(255) NOT NULL,
    `storagePath` VARCHAR(500) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `generation_assets_generationId_idx`(`generationId`),
    INDEX `generation_assets_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generation_prompts` (
    `id` VARCHAR(36) NOT NULL,
    `generationId` VARCHAR(36) NOT NULL,
    `referenceAnalysisRaw` JSON NULL,
    `structuredPromptJson` JSON NOT NULL,
    `finalPrompt` TEXT NOT NULL,
    `systemPrompt` TEXT NULL,
    `promptVersion` VARCHAR(20) NOT NULL DEFAULT '1.0',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `generation_prompts_generationId_key`(`generationId`),
    INDEX `generation_prompts_generationId_idx`(`generationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `subscriptionId` VARCHAR(36) NULL,
    `type` ENUM('SUBSCRIPTION', 'SINGLE_VARIANT', 'COMBO_VARIANTS') NOT NULL,
    `method` ENUM('PIX', 'CREDIT_CARD', 'BOLETO') NOT NULL DEFAULT 'PIX',
    `status` ENUM('PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGEBACK') NOT NULL DEFAULT 'PENDING',
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'BRL',
    `description` VARCHAR(500) NULL,
    `idempotencyKey` VARCHAR(255) NOT NULL,
    `mpPaymentId` VARCHAR(100) NULL,
    `mpStatus` VARCHAR(50) NULL,
    `mpStatusDetail` VARCHAR(100) NULL,
    `mpExternalRef` VARCHAR(255) NULL,
    `pixQrCode` TEXT NULL,
    `pixQrCodeText` TEXT NULL,
    `pixExpiresAt` DATETIME(3) NULL,
    `pixTransactionId` VARCHAR(100) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `refundedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `metadata` JSON NULL,

    UNIQUE INDEX `payments_idempotencyKey_key`(`idempotencyKey`),
    INDEX `payments_tenantId_idx`(`tenantId`),
    INDEX `payments_userId_idx`(`userId`),
    INDEX `payments_status_idx`(`status`),
    INDEX `payments_mpPaymentId_idx`(`mpPaymentId`),
    INDEX `payments_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_items` (
    `id` VARCHAR(36) NOT NULL,
    `paymentId` VARCHAR(36) NOT NULL,
    `variantId` VARCHAR(36) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `description` VARCHAR(255) NULL,

    INDEX `payment_items_paymentId_idx`(`paymentId`),
    INDEX `payment_items_variantId_idx`(`variantId`),
    UNIQUE INDEX `payment_items_paymentId_variantId_key`(`paymentId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NULL,
    `paymentId` VARCHAR(36) NULL,
    `provider` VARCHAR(50) NOT NULL DEFAULT 'mercadopago',
    `eventType` VARCHAR(100) NOT NULL,
    `externalEventId` VARCHAR(255) NULL,
    `status` ENUM('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED', 'DUPLICATE') NOT NULL DEFAULT 'RECEIVED',
    `payload` JSON NOT NULL,
    `signatureValid` BOOLEAN NOT NULL DEFAULT false,
    `processedAt` DATETIME(3) NULL,
    `errorMessage` TEXT NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `webhook_events_provider_idx`(`provider`),
    INDEX `webhook_events_eventType_idx`(`eventType`),
    INDEX `webhook_events_status_idx`(`status`),
    INDEX `webhook_events_externalEventId_idx`(`externalEventId`),
    INDEX `webhook_events_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `downloads` (
    `id` VARCHAR(36) NOT NULL,
    `variantId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `paymentId` VARCHAR(36) NOT NULL,
    `downloadedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `signedUrlUsed` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `fileSizeBytes` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `downloads_variantId_idx`(`variantId`),
    INDEX `downloads_userId_idx`(`userId`),
    INDEX `downloads_paymentId_idx`(`paymentId`),
    INDEX `downloads_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NULL,
    `userId` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `resourceType` VARCHAR(50) NULL,
    `resourceId` VARCHAR(36) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `requestId` VARCHAR(36) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_tenantId_idx`(`tenantId`),
    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    INDEX `audit_logs_resourceType_resourceId_idx`(`resourceType`, `resourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usage_counters` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `generationsUsed` INTEGER NOT NULL DEFAULT 0,
    `generationsLimit` INTEGER NOT NULL DEFAULT 30,
    `thumbsDownloaded` INTEGER NOT NULL DEFAULT 0,
    `estimatedCostCents` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `usage_counters_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `usage_counters_tenantId_periodYear_periodMonth_key`(`tenantId`, `periodYear`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `monthly_quota_snapshots` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `generationsUsed` INTEGER NOT NULL,
    `generationsLimit` INTEGER NOT NULL,
    `thumbsPurchased` INTEGER NOT NULL,
    `thumbsDownloaded` INTEGER NOT NULL,
    `revenueFromThumbs` INTEGER NOT NULL,
    `subscriptionRevenue` INTEGER NOT NULL,
    `estimatedAICost` INTEGER NOT NULL,
    `snapshotAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `monthly_quota_snapshots_tenantId_idx`(`tenantId`),
    INDEX `monthly_quota_snapshots_periodYear_periodMonth_idx`(`periodYear`, `periodMonth`),
    UNIQUE INDEX `monthly_quota_snapshots_tenantId_periodYear_periodMonth_key`(`tenantId`, `periodYear`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `tenantId` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `type` ENUM('GENERATION_COMPLETE', 'GENERATION_FAILED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED', 'DOWNLOAD_READY', 'SUBSCRIPTION_EXPIRING', 'QUOTA_WARNING', 'SYSTEM') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `readAt` DATETIME(3) NULL,
    `data` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `notifications_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_flags` (
    `id` VARCHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `description` VARCHAR(500) NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedById` VARCHAR(36) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `feature_flags_key_key`(`key`),
    INDEX `feature_flags_key_idx`(`key`),
    INDEX `feature_flags_isEnabled_idx`(`isEnabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` VARCHAR(36) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `valueType` VARCHAR(20) NOT NULL DEFAULT 'string',
    `description` VARCHAR(500) NULL,
    `isSecret` BOOLEAN NOT NULL DEFAULT false,
    `updatedById` VARCHAR(36) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_settings_category_idx`(`category`),
    UNIQUE INDEX `system_settings_category_key_key`(`category`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jobs` (
    `id` VARCHAR(36) NOT NULL,
    `queueName` VARCHAR(100) NOT NULL,
    `jobId` VARCHAR(255) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `status` ENUM('WAITING', 'ACTIVE', 'COMPLETED', 'FAILED', 'DELAYED', 'STALLED') NOT NULL DEFAULT 'WAITING',
    `payload` JSON NOT NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `jobs_queueName_idx`(`queueName`),
    INDEX `jobs_status_idx`(`status`),
    INDEX `jobs_type_idx`(`type`),
    INDEX `jobs_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `jobs_queueName_jobId_key`(`queueName`, `jobId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_referredByUserId_fkey` FOREIGN KEY (`referredByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `template_versions` ADD CONSTRAINT `template_versions_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_saved_models` ADD CONSTRAINT `user_saved_models_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_saved_models` ADD CONSTRAINT `user_saved_models_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_requests` ADD CONSTRAINT `generation_requests_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_requests` ADD CONSTRAINT `generation_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_requests` ADD CONSTRAINT `generation_requests_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_requests` ADD CONSTRAINT `generation_requests_aiProviderId_fkey` FOREIGN KEY (`aiProviderId`) REFERENCES `ai_providers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_variants` ADD CONSTRAINT `generation_variants_generationId_fkey` FOREIGN KEY (`generationId`) REFERENCES `generation_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_assets` ADD CONSTRAINT `generation_assets_generationId_fkey` FOREIGN KEY (`generationId`) REFERENCES `generation_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `generation_prompts` ADD CONSTRAINT `generation_prompts_generationId_fkey` FOREIGN KEY (`generationId`) REFERENCES `generation_requests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_items` ADD CONSTRAINT `payment_items_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_items` ADD CONSTRAINT `payment_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `generation_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_events` ADD CONSTRAINT `webhook_events_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_events` ADD CONSTRAINT `webhook_events_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `downloads` ADD CONSTRAINT `downloads_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `generation_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `downloads` ADD CONSTRAINT `downloads_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_counters` ADD CONSTRAINT `usage_counters_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `monthly_quota_snapshots` ADD CONSTRAINT `monthly_quota_snapshots_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

