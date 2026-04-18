// ─────────────────────────────────────────────────────────────────────────────
// ThumbForge AI — Shared Enums
// ─────────────────────────────────────────────────────────────────────────────

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TRIAL = 'TRIAL',
  CANCELLED = 'CANCELLED',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  TRIAL = 'TRIAL',
  PENDING = 'PENDING',
}

export enum GenerationStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum VariantStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PAID = 'PAID',
  AVAILABLE = 'AVAILABLE',
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  CHARGEBACK = 'CHARGEBACK',
}

export enum PaymentType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  SINGLE_VARIANT = 'SINGLE_VARIANT',
  COMBO_VARIANTS = 'COMBO_VARIANTS',
}

export enum PaymentMethod {
  PIX = 'PIX',
  CREDIT_CARD = 'CREDIT_CARD',
  BOLETO = 'BOLETO',
}

export enum TemplateCategory {
  GAMER_FPS = 'GAMER_FPS',
  BATTLE_ROYALE = 'BATTLE_ROYALE',
  MOBILE_GAME = 'MOBILE_GAME',
  UNBOXING = 'UNBOXING',
  REACTION = 'REACTION',
  TUTORIAL = 'TUTORIAL',
  CLICKBAIT_ENERGY = 'CLICKBAIT_ENERGY',
  CLEAN_MINIMAL = 'CLEAN_MINIMAL',
  CINEMATIC = 'CINEMATIC',
  CUSTOM = 'CUSTOM',
}

export enum AssetType {
  REFERENCE = 'REFERENCE',
  PERSON = 'PERSON',
  OBJECT = 'OBJECT',
  BACKGROUND = 'BACKGROUND',
  BACKGROUND_UI = 'BACKGROUND_UI',
  EFFECT = 'EFFECT',
  LOGO = 'LOGO',
  BADGE = 'BADGE',
  ICON = 'ICON',
  OTHER = 'OTHER',
}

export enum AIProvider {
  OPENAI = 'OPENAI',
  STABILITY = 'STABILITY',
  REPLICATE = 'REPLICATE',
  CUSTOM = 'CUSTOM',
}

export enum JobStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DELAYED = 'DELAYED',
  STALLED = 'STALLED',
}

export enum NotificationType {
  GENERATION_COMPLETE = 'GENERATION_COMPLETE',
  GENERATION_FAILED = 'GENERATION_FAILED',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  DOWNLOAD_READY = 'DOWNLOAD_READY',
  SUBSCRIPTION_EXPIRING = 'SUBSCRIPTION_EXPIRING',
  QUOTA_WARNING = 'QUOTA_WARNING',
  SYSTEM = 'SYSTEM',
}

export enum AuditAction {
  // Auth
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_REGISTER = 'user.register',
  USER_PASSWORD_RESET = 'user.password_reset',
  // Generations
  GENERATION_CREATE = 'generation.create',
  GENERATION_VIEW_PREVIEW = 'generation.view_preview',
  // Payments
  PAYMENT_CREATE = 'payment.create',
  PAYMENT_APPROVED = 'payment.approved',
  PAYMENT_REJECTED = 'payment.rejected',
  WEBHOOK_RECEIVED = 'webhook.received',
  // Downloads
  DOWNLOAD_REQUEST = 'download.request',
  DOWNLOAD_COMPLETE = 'download.complete',
  // Admin
  ADMIN_USER_SUSPEND = 'admin.user.suspend',
  ADMIN_USER_IMPERSONATE = 'admin.user.impersonate',
  ADMIN_SETTINGS_UPDATE = 'admin.settings.update',
  ADMIN_QUOTA_RESET = 'admin.quota.reset',
}

export enum VariantType {
  CONSERVADORA = 'CONSERVADORA',
  VIRAL        = 'VIRAL',
  CLEAN        = 'CLEAN',
  DRAMATICA    = 'DRAMATICA',
  EXTREMA      = 'EXTREMA',
  PREMIUM      = 'PREMIUM',
}

export enum FeatureFlagKey {
  TRIAL_ENABLED = 'trial_enabled',
  TRIAL_GENERATIONS = 'trial_generations',
  EMAIL_VERIFICATION = 'email_verification_required',
  REFERRAL_ENABLED = 'referral_enabled',
  REFERRAL_BONUS_GENERATIONS = 'referral_bonus_generations',
  PIX_ENABLED = 'pix_enabled',
  CREDIT_CARD_ENABLED = 'credit_card_enabled',
  BOLETO_ENABLED = 'boleto_enabled',
  INSTALLMENTS_ENABLED = 'installments_enabled',
  MAX_INSTALLMENTS = 'max_installments',
  PREVIEW_BLUR = 'preview_blur',
  PREVIEW_WATERMARK_OPACITY = 'preview_watermark_opacity',
  PREVIEW_RESOLUTION = 'preview_resolution',
  GENERATION_QUEUE_PRIORITY = 'generation_queue_priority',
}
