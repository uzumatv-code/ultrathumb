// =============================================================================
// ThumbForge AI — Payments Routes
// =============================================================================

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PaymentType } from '@thumbforge/shared';
import { PaymentsService } from './payments.service.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { logger } from '../../shared/utils/logger.js';

const createPaymentSchema = z.object({
  type: z.nativeEnum(PaymentType),
  variantIds: z.array(z.string().uuid()).optional(),
  subscriptionPlanId: z.string().uuid().optional(),
});

export async function paymentsRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new PaymentsService();

  // POST /payments — Create payment (authenticated)
  fastify.post(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const body = createPaymentSchema.parse(request.body);

      const result = await service.createPayment(
        request.tenantId,
        request.user.sub,
        body,
        request.ip,
      );

      return reply.code(201).send({ success: true, data: result });
    },
  );

  // GET /payments — List payments for tenant
  fastify.get(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const payments = await fastify.prisma.payment.findMany({
        where: { tenantId: request.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          method: true,
          status: true,
          amountCents: true,
          pixExpiresAt: true,
          approvedAt: true,
          createdAt: true,
          items: {
            select: {
              variantId: true,
              amountCents: true,
            },
          },
        },
      });

      return reply.send({ success: true, data: payments });
    },
  );

  // GET /payments/:id — Get payment details
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const payment = await fastify.prisma.payment.findFirst({
        where: { id: request.params.id, tenantId: request.tenantId },
        include: { items: true },
      });

      if (!payment) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Payment not found' },
        });
      }

      return reply.send({ success: true, data: payment });
    },
  );
}

// ─── Webhook Route (Public — no auth, validate by signature) ─────────────────

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new PaymentsService();

  // POST /webhooks/mercadopago
  fastify.post(
    '/mercadopago',
    {
      config: { rawBody: true }, // needed for signature validation
    },
    async (request, reply) => {
      const signature = (request.headers['x-signature'] as string) ?? '';
      const requestId = (request.headers['x-request-id'] as string) ?? crypto.randomUUID();

      logger.info({ requestId, signature: signature.slice(0, 20) }, 'MP webhook received');

      try {
        await service.processWebhook(
          request.body as Record<string, unknown>,
          signature,
          requestId,
          request.ip,
        );

        // Always return 200 to MP (even if we reject — avoids retries for invalid sigs)
        return reply.code(200).send({ received: true });
      } catch (err) {
        logger.error({ err, requestId }, 'Webhook processing error');
        return reply.code(200).send({ received: true });
      }
    },
  );
}
