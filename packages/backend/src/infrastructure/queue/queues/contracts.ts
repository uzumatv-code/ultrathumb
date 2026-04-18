// =============================================================================
// ThumbForge AI - BullMQ Queue Contracts
// =============================================================================

export const QUEUE_NAMES = {
  GENERATION_AI: 'generation-ai',
  GENERATION_POST: 'generation-post',
  PAYMENT_WEBHOOK: 'payment-webhook',
  PAYMENT_RECONCILE: 'payment-reconcile',
  NOTIFICATION_EMAIL: 'notification-email',
  STORAGE_CLEANUP: 'storage-cleanup',
  AUDIT_WRITE: 'audit-write',
} as const;

export interface GenerationAiJobData {
  generationId: string;
  tenantId: string;
  userId: string;
  variantTypes?: import('@thumbforge/shared').VariantType[];
}

export interface GenerationPostJobData {
  generationId: string;
  tenantId: string;
  variantPaths: Array<{
    index: number;
    hdPath: string;
    imageBuffer: string;
  }>;
}

export interface PaymentWebhookJobData {
  webhookEventId: string;
  provider: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface PaymentReconcileJobData {
  olderThanMinutes: number;
}

export interface NotificationEmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, unknown>;
}

export interface AuditWriteJobData {
  tenantId?: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}
