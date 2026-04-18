// =============================================================================
// ThumbForge AI — Application Error Hierarchy
// =============================================================================

export type ErrorCode =
  // Auth
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'ACCOUNT_SUSPENDED'
  // Validation
  | 'VALIDATION_ERROR'
  | 'INVALID_INPUT'
  // Resources
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'CONFLICT'
  // Business Rules
  | 'QUOTA_EXCEEDED'
  | 'SUBSCRIPTION_REQUIRED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'PAYMENT_REQUIRED'
  | 'PAYMENT_NOT_APPROVED'
  | 'DOWNLOAD_NOT_AUTHORIZED'
  | 'DOWNLOAD_EXPIRED'
  | 'GENERATION_FAILED'
  // Upload
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'UPLOAD_FAILED'
  // External
  | 'AI_PROVIDER_ERROR'
  | 'PAYMENT_PROVIDER_ERROR'
  | 'STORAGE_ERROR'
  | 'EMAIL_ERROR'
  // System
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'IDEMPOTENCY_CONFLICT';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 500,
    details?: Record<string, unknown>,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Specific Error Classes ────────────────────────────────────────────────

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', id ? `${resource} '${id}' not found` : `${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 422, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class QuotaExceededError extends AppError {
  constructor(used: number, limit: number) {
    super('QUOTA_EXCEEDED', `Quota exceeded: ${used}/${limit} generations used this month`, 429, { used, limit });
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = 'Payment required to access this resource') {
    super('PAYMENT_REQUIRED', message, 402);
  }
}

export class PaymentNotApprovedError extends AppError {
  constructor(paymentId: string) {
    super('PAYMENT_NOT_APPROVED', `Payment ${paymentId} is not approved`, 402, { paymentId });
  }
}

export class DownloadExpiredError extends AppError {
  constructor() {
    super('DOWNLOAD_EXPIRED', 'This download link has expired', 410);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterMs: number) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    super('RATE_LIMIT_EXCEEDED', `Too many requests. Try again in ${retryAfterSec} seconds`, 429, { retryAfterMs });
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('AI_PROVIDER_ERROR', message, 502, details);
  }
}

export class StorageError extends AppError {
  constructor(message: string) {
    super('STORAGE_ERROR', message, 502);
  }
}
