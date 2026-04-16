import type { FastifyInstance } from 'fastify';
import { TemplateCategory } from '@prisma/client';
import { z } from 'zod';

const listTemplatesQuerySchema = z.object({
  category: z.nativeEnum(TemplateCategory).optional(),
});

export async function templatesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, reply) => {
    const query = listTemplatesQuerySchema.parse(request.query);

    const templates = await fastify.prisma.template.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(query.category ? { category: query.category } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        previewImageUrl: true,
        demoImageUrl: true,
        isPremium: true,
        isActive: true,
        tags: true,
        recommendedFonts: true,
        defaultStyleConfig: true,
      },
    });

    return reply.send({ success: true, data: templates });
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const template = await fastify.prisma.template.findFirst({
      where: {
        id: request.params.id,
        isActive: true,
        deletedAt: null,
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
        },
      },
    });

    if (!template) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Template not found' },
      });
    }

    return reply.send({ success: true, data: template });
  });
}
