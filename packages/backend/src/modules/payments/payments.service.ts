// =============================================================================
// ThumbForge AI — Payments Service (Mercado Pago)
// =============================================================================

import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import {
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus as PrismaPaymentStatus,
  PaymentType as PrismaPaymentType,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/client.js';
import { logger } from '../../shared/utils/logger.js';
import {
  NotFoundError,
  ConflictError,
  PaymentNotApprovedError,
  ValidationError,
} from '../../shared/errors/AppError.js';
import { generateIdempotencyKey } from '../../shared/utils/idempotency.js';
import type { CreatePaymentRequest } from '@thumbforge/shared';
import crypto from 'node:crypto';

function isQueueRuntimeEnabled(): boolean {
  return process.env['REDIS_DISABLED'] !== 'true';
}

// Pricing (fallback to env if DB setting not found)
async function getPricingSettings() {
  const settings = await prisma.systemSetting.findMany({
    where: {
      category: 'pricing',
      key: { in: ['plan_price_cents', 'single_thumb_price_cents', 'combo_price_cents'] },
    },
  });

  const map = Object.fromEntries(
    settings.map((setting) => [setting.key, parseInt(setting.value, 10)]),
  );
  return {
    planPriceCents: map['plan_price_cents'] ?? 4990,
    singleThumbPriceCents: map['single_thumb_price_cents'] ?? 1990,
    comboPriceCents: map['combo_price_cents'] ?? 4000,
  };
}

function getMPClient(): MercadoPagoConfig {
  const token = process.env['MP_ACCESS_TOKEN'];
  if (!token) throw new Error('MP_ACCESS_TOKEN not set');
  return new MercadoPagoConfig({ accessToken: token });
}

export class PaymentsService {
  async createPayment(
    tenantId: string,
    userId: string,
    input: CreatePaymentRequest,
    ipAddress?: string,
  ) {
    const pricing = await getPricingSettings();

    // Validate and compute amount
    let amountCents: number;
    let description: string;
    let variantIds: string[] = [];

    if (input.type === 'SUBSCRIPTION') {
      if (!input.subscriptionPlanId) {
        throw new ValidationError('subscriptionPlanId required for SUBSCRIPTION payment');
      }
      amountCents = pricing.planPriceCents;
      description = 'ThumbForge AI — Assinatura Mensal';
    } else if (input.type === 'SINGLE_VARIANT') {
      if (!input.variantIds?.length || input.variantIds.length !== 1) {
        throw new ValidationError('Exactly 1 variantId required for SINGLE_VARIANT');
      }
      variantIds = input.variantIds;
      await this.validateVariants(variantIds, tenantId);
      amountCents = pricing.singleThumbPriceCents;
      description = 'ThumbForge AI — Thumbnail (1 unidade)';
    } else if (input.type === 'COMBO_VARIANTS') {
      if (!input.variantIds?.length || input.variantIds.length !== 3) {
        throw new ValidationError('Exactly 3 variantIds required for COMBO_VARIANTS');
      }
      variantIds = input.variantIds;
      await this.validateVariants(variantIds, tenantId);
      amountCents = pricing.comboPriceCents;
      description = 'ThumbForge AI — Combo (3 thumbnails)';
    } else {
      throw new ValidationError('Invalid payment type');
    }

    // Idempotency key
    const idempotencyKey = generateIdempotencyKey(
      tenantId,
      userId,
      input.type,
      variantIds.join(',') || input.subscriptionPlanId,
    );

    // Check for existing payment with same idempotency key
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.status === 'APPROVED') {
        throw new ConflictError('Payment already approved for these items');
      }
      // Return existing pending payment (idempotent)
      return this.formatPaymentResponse(existing);
    }

    // Create MP payment (PIX)
    const mpClient = getMPClient();
    const mpPaymentClient = new MPPayment(mpClient);

    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 30); // 30 min PIX window

    const mpPaymentBody = {
      transaction_amount: amountCents / 100,
      description,
      payment_method_id: 'pix',
      payer: {
        email: await this.getUserEmail(userId),
      },
      date_of_expiration: expirationDate.toISOString(),
      external_reference: idempotencyKey,
      metadata: { tenantId, userId, type: input.type },
      ...(process.env['MP_NOTIFICATION_URL']
        ? { notification_url: process.env['MP_NOTIFICATION_URL'] }
        : {}),
    };

    const mpResponse = await mpPaymentClient.create({
      body: mpPaymentBody,
    });

    if (!mpResponse.id) {
      throw new Error('Failed to create MP payment');
    }

    const pixData = mpResponse.point_of_interaction?.transaction_data;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        userId,
        subscriptionId: null,
        type: input.type as unknown as PrismaPaymentType,
        method: PrismaPaymentMethod.PIX,
        status: PrismaPaymentStatus.PENDING,
        amountCents,
        description,
        idempotencyKey,
        mpPaymentId: mpResponse.id.toString(),
        mpStatus: mpResponse.status ?? null,
        mpExternalRef: idempotencyKey,
        pixQrCode: pixData?.qr_code_base64 ?? null,
        pixQrCodeText: pixData?.qr_code ?? null,
        pixExpiresAt: expirationDate,
        metadata: { ipAddress },
      },
    });

    // Create payment items
    if (variantIds.length > 0) {
      await prisma.paymentItem.createMany({
        data: variantIds.map((variantId) => ({
          paymentId: payment.id,
          variantId,
          amountCents: Math.floor(amountCents / variantIds.length),
        })),
      });
    }

    logger.info(
      { paymentId: payment.id, mpPaymentId: mpResponse.id, type: input.type },
      'Payment created',
    );

    return this.formatPaymentResponse(payment);
  }

  // ─── Webhook Processing ────────────────────────────────────────────────────

  async processWebhook(
    payload: Record<string, unknown>,
    signature: string,
    requestId: string,
    ipAddress?: string,
  ): Promise<void> {
    // Validate signature
    const isValid = this.validateMPSignature(payload, signature);

    // Store webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        provider: 'mercadopago',
        eventType: (payload['type'] as string) ?? 'unknown',
        externalEventId: (payload['id'] as string) ?? null,
        status: 'RECEIVED',
        payload: payload as object,
        signatureValid: isValid,
        ipAddress: ipAddress ?? null,
      },
    });

    if (!isValid) {
      logger.warn({ requestId, webhookEventId: webhookEvent.id }, 'Invalid webhook signature');
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: 'IGNORED' },
      });
      return;
    }

    if (!isQueueRuntimeEnabled()) {
      logger.warn(
        { requestId, webhookEventId: webhookEvent.id },
        'Redis queue disabled, processing webhook inline',
      );

      setTimeout(() => {
        void this.handleWebhookEvent(webhookEvent.id).catch((err: unknown) => {
          logger.error({ err, requestId, webhookEventId: webhookEvent.id }, 'Inline webhook failed');
        });
      }, 0);

      return;
    }

    const { getPaymentWebhookQueue } = await import('../../infrastructure/queue/queues/index.js');
    await getPaymentWebhookQueue().add('process-webhook', {
      webhookEventId: webhookEvent.id,
      provider: 'mercadopago',
      eventType: (payload['type'] as string) ?? 'unknown',
      payload,
    });
  }

  async handleWebhookEvent(webhookEventId: string): Promise<void> {
    const event = await prisma.webhookEvent.findUniqueOrThrow({
      where: { id: webhookEventId },
    });

    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: 'PROCESSING', processedAt: new Date() },
    });

    try {
      const payload = event.payload as Record<string, unknown>;
      const eventType = event.eventType;

      if (eventType === 'payment') {
        await this.handlePaymentNotification(payload);
      }

      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSED' },
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: 'FAILED',
          errorMessage: error,
          retryCount: { increment: 1 },
        },
      });
      throw err;
    }
  }

  async handlePaymentNotification(payload: Record<string, unknown>): Promise<void> {
    const mpPaymentId = (payload['data'] as Record<string, string>)?.['id'];
    if (!mpPaymentId) return;

    // Fetch payment details from MP API
    const mpClient = getMPClient();
    const mpPaymentClient = new MPPayment(mpClient);
    const mpPayment = await mpPaymentClient.get({ id: mpPaymentId });

    const internalPayment = await prisma.payment.findFirst({
      where: { mpPaymentId },
      include: { items: true },
    });

    if (!internalPayment) {
      logger.warn({ mpPaymentId }, 'Payment not found for webhook');
      return;
    }

    const newStatus = this.mapMPStatus(mpPayment.status ?? 'pending');
    const now = new Date();

    await prisma.payment.update({
      where: { id: internalPayment.id },
      data: {
        status: newStatus,
        mpStatus: mpPayment.status ?? null,
        mpStatusDetail: mpPayment.status_detail ?? null,
        ...(newStatus === 'APPROVED' && { approvedAt: now }),
        ...(newStatus === 'REJECTED' && { rejectedAt: now }),
        ...(newStatus === 'CANCELLED' && { cancelledAt: now }),
      },
    });

    // If approved, liberate variants
    if (newStatus === 'APPROVED') {
      await this.liberateVariants(internalPayment);
    }

    logger.info(
      { paymentId: internalPayment.id, mpPaymentId, status: newStatus },
      'Payment status updated',
    );
  }

  // Reconciliation: check pending payments older than X minutes
  async reconcilePendingPayments(olderThanMinutes: number): Promise<void> {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - olderThanMinutes);

    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
      },
      take: 50,
    });

    logger.info({ count: pendingPayments.length }, 'Reconciling pending payments');

    const mpClient = getMPClient();
    const mpPaymentClient = new MPPayment(mpClient);

    for (const payment of pendingPayments) {
      if (!payment.mpPaymentId) continue;
      try {
        const mpPayment = await mpPaymentClient.get({ id: payment.mpPaymentId });
        const newStatus = this.mapMPStatus(mpPayment.status ?? 'pending');

        if (newStatus !== 'PENDING') {
          await this.handlePaymentNotification({
            data: { id: payment.mpPaymentId },
          });
        }
      } catch (err) {
        logger.error({ err, paymentId: payment.id }, 'Reconciliation error');
      }
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async validateVariants(variantIds: string[], tenantId: string): Promise<void> {
    const variants = await prisma.generationVariant.findMany({
      where: {
        id: { in: variantIds },
        generation: { tenantId },
        isPaid: false,
      },
    });

    if (variants.length !== variantIds.length) {
      throw new ValidationError('Invalid or already paid variants');
    }
  }

  private async liberateVariants(payment: {
    id: string;
    items: Array<{ variantId: string }>;
    type: string;
    tenantId: string;
    userId: string;
  }): Promise<void> {
    const variantIds = payment.items.map((i) => i.variantId);

    await prisma.generationVariant.updateMany({
      where: { id: { in: variantIds } },
      data: { isPaid: true, status: 'AVAILABLE', paidAt: new Date() },
    });

    // Create download records
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 day retention

    await prisma.download.createMany({
      data: variantIds.map((variantId) => ({
        variantId,
        userId: payment.userId,
        paymentId: payment.id,
        expiresAt,
      })),
    });

    logger.info(
      { paymentId: payment.id, variantIds },
      'Variants liberated for download',
    );

    // TODO: Send notification to user via WebSocket + email
  }

  private async getUserEmail(userId: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    return user.email;
  }

  private mapMPStatus(mpStatus: string): PrismaPaymentStatus {
    const statusMap: Record<string, PrismaPaymentStatus> = {
      pending: PrismaPaymentStatus.PENDING,
      in_process: PrismaPaymentStatus.PROCESSING,
      approved: PrismaPaymentStatus.APPROVED,
      rejected: PrismaPaymentStatus.REJECTED,
      cancelled: PrismaPaymentStatus.CANCELLED,
      refunded: PrismaPaymentStatus.REFUNDED,
      charged_back: PrismaPaymentStatus.CHARGEBACK,
    };
    return statusMap[mpStatus] ?? PrismaPaymentStatus.PENDING;
  }

  private validateMPSignature(
    payload: Record<string, unknown>,
    signature: string,
  ): boolean {
    const secret = process.env['MP_WEBHOOK_SECRET'];
    if (!secret) {
      logger.warn('MP_WEBHOOK_SECRET not set — skipping signature validation');
      return true; // Fail open in dev, fail closed in prod
    }

    try {
      const parts = signature.split(',');
      const ts = parts.find((p) => p.startsWith('ts='))?.replace('ts=', '') ?? '';
      const v1 = parts.find((p) => p.startsWith('v1='))?.replace('v1=', '') ?? '';

      const manifest = `id:${payload['id']};request-id:${payload['requestId'] ?? ''};ts:${ts};`;
      const expected = crypto
        .createHmac('sha256', secret)
        .update(manifest)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private formatPaymentResponse(payment: {
    id: string;
    pixQrCode?: string | null;
    pixQrCodeText?: string | null;
    pixExpiresAt?: Date | null;
    amountCents: number;
    status: string;
  }) {
    return {
      paymentId: payment.id,
      pixQrCode: payment.pixQrCode,
      pixQrCodeText: payment.pixQrCodeText,
      pixExpiresAt: payment.pixExpiresAt?.toISOString(),
      amountCents: payment.amountCents,
      status: payment.status,
    };
  }
}
