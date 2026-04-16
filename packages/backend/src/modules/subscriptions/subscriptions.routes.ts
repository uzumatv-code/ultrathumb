import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../shared/middlewares/authenticate.js';

function getCurrentPeriod() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { now, periodStart, periodEnd };
}

export async function subscriptionsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/current', { preHandler: [authenticate] }, async (request, reply) => {
    const { now, periodStart, periodEnd } = getCurrentPeriod();

    const [subscription, usageCounter] = await Promise.all([
      fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenantId,
          status: { in: ['ACTIVE', 'TRIAL', 'PENDING', 'PAST_DUE'] },
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              description: true,
              priceCents: true,
              generationsLimit: true,
              features: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ currentPeriodEnd: 'desc' }, { createdAt: 'desc' }],
      }),
      fastify.prisma.usageCounter.findUnique({
        where: {
          tenantId_periodYear_periodMonth: {
            tenantId: request.tenantId,
            periodYear: now.getFullYear(),
            periodMonth: now.getMonth() + 1,
          },
        },
      }),
    ]);

    const generationsLimit =
      usageCounter?.generationsLimit ??
      subscription?.plan.generationsLimit ??
      30;
    const generationsUsed = usageCounter?.generationsUsed ?? 0;

    return reply.send({
      success: true,
      data: {
        id: subscription?.id ?? null,
        tenantId: request.tenantId,
        planId: subscription?.planId ?? subscription?.plan.id ?? null,
        status: subscription?.status ?? 'PENDING',
        currentPeriodStart: subscription?.currentPeriodStart ?? periodStart,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? periodEnd,
        generationsUsed,
        generationsLimit,
        generationsRemaining: Math.max(generationsLimit - generationsUsed, 0),
        plan: subscription?.plan ?? null,
      },
    });
  });
}
