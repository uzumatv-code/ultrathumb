import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DownloadsService } from './downloads.service.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';

const variantParamsSchema = z.object({
  variantId: z.string().uuid(),
});

export async function downloadsRoutes(fastify: FastifyInstance): Promise<void> {
  const service = new DownloadsService();

  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const downloads = await service.listDownloads(request.user.sub, request.tenantId);
    return reply.send({ success: true, data: downloads });
  });

  fastify.get<{ Params: { variantId: string } }>('/:variantId', async (request, reply) => {
    const params = variantParamsSchema.parse(request.params);
    const result = await service.requestDownload(
      params.variantId,
      request.tenantId,
      request.user.sub,
      request.ip,
      request.headers['user-agent'],
    );

    return reply.send({ success: true, data: result });
  });
}
