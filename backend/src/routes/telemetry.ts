import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { systemFlowSeries, usageReport, type ReportPeriod, type TelemetryRange } from '../lib/telemetry.js';

const PERIODS: ReportPeriod[] = ['today', '7days', '30days'];
const RANGES: TelemetryRange[] = ['1h', '1d', '1w', '1m'];

export async function telemetryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/system-flow', async (request) => {
    const query = request.query as { range?: string };
    const range = RANGES.includes(query.range as TelemetryRange)
      ? (query.range as TelemetryRange)
      : '1h';
    const points = await systemFlowSeries(range);
    return { range, points };
  });

  app.get('/report', async (request, reply) => {
    const query = request.query as {
      period?: string;
      nodeId?: string;
      fromTime?: string;
      toTime?: string;
    };
    const period = PERIODS.includes(query.period as ReportPeriod)
      ? (query.period as ReportPeriod)
      : '7days';
    const nodeId = query.nodeId?.trim();
    try {
      return await usageReport({
        period,
        nodeId: nodeId && nodeId !== 'all' ? nodeId : undefined,
        fromTime: query.fromTime,
        toTime: query.toTime,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: err instanceof Error ? err.message : 'Failed to load report',
      });
    }
  });
}
