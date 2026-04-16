// =============================================================================
// ThumbForge AI — Structured Logger (Pino)
// =============================================================================

import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production: structured JSON
        formatters: {
          level: (label: string) => ({ level: label }),
          bindings: () => ({}),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
});

// ─── Child logger factory (add context) ───────────────────────────────────

export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

export function requestLogger(opts: {
  requestId: string;
  tenantId?: string;
  userId?: string;
  method?: string;
  url?: string;
}) {
  return logger.child({
    requestId: opts.requestId,
    ...(opts.tenantId && { tenantId: opts.tenantId }),
    ...(opts.userId && { userId: opts.userId }),
    ...(opts.method && { method: opts.method }),
    ...(opts.url && { url: opts.url }),
  });
}
