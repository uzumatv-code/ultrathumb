import type { FastifyInstance } from 'fastify';

export async function plansRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, reply) => {
    const plans = await fastify.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        priceCents: true,
        generationsLimit: true,
        features: true,
        isActive: true,
        isFeatured: true,
      },
    });

    return reply.send({ success: true, data: plans });
  });
}
