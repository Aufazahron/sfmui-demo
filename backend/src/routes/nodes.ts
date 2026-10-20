import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { usageByNodeId, type NodeUsage } from '../lib/usage.js';
import { telemetrySeries, type TelemetryRange } from '../lib/telemetry.js';
import { invalidateNodeCache } from '../mqtt/ingest.js';
import { isMqttConnected, publishCommand } from '../mqtt/client.js';
import { randomUUID } from 'node:crypto';

const scheduleSchema = z.object({
  active: z.boolean(),
  days: z.array(z.string()),
  openTime: z.string(),
  closeTime: z.string(),
});

const createNodeSchema = z.object({
  deviceId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().min(1).max(120),
  location: z.string().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  dailyLimit: z.number().nonnegative().optional(),
  mode: z.enum(['manual', 'automatic']).optional(),
  schedule: scheduleSchema.optional(),
});

const patchNodeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  location: z.string().min(1).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
  dailyLimit: z.number().nonnegative().optional(),
  mode: z.enum(['manual', 'automatic']).optional(),
  valveState: z.enum(['open', 'closed']).optional(),
  reason: z.string().max(500).optional(),
  schedule: scheduleSchema.optional(),
}).refine(
  (data) => !data.valveState || (typeof data.reason === 'string' && data.reason.trim().length > 0),
  { message: 'Description is required when changing valve', path: ['reason'] },
);

function toApiNode(
  node: {
    id: string;
    deviceId: string;
    name: string;
    location: string;
    parentId: string | null;
    status: string;
    valveState: string;
    mode: string;
    dailyLimit: number;
    schedule: unknown;
    lastSeenAt: Date | null;
    statusChangedAt: Date;
    lastOdometer: number;
    lastFlowrate: number;
    lastTelemetrySeq: number;
    configVersion: number;
    configAckedVersion: number;
    updatedAt: Date;
  },
  usage?: NodeUsage,
) {
  return {
    id: node.id,
    deviceId: node.deviceId,
    name: node.name,
    location: node.location,
    parentId: node.parentId,
    status: node.status,
    valveState: node.valveState,
    mode: node.mode,
    flowrate: node.lastFlowrate,
    todayUsage: usage?.todayUsage ?? 0,
    dailyLimit: node.dailyLimit,
    monthlyUsage: usage?.monthlyUsage ?? 0,
    odometer: usage?.odometer ?? 0,
    lastUpdate: (node.lastSeenAt ?? node.updatedAt).toISOString(),
    statusChangedAt: node.statusChangedAt.toISOString(),
    schedule: node.schedule,
    alerts: [],
    configVersion: node.configVersion,
    configAckedVersion: node.configAckedVersion,
    configSynced: node.configVersion === node.configAckedVersion,
  };
}

export async function nodeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async () => {
    const nodes = await prisma.node.findMany({ orderBy: { createdAt: 'asc' } });
    const usage = await usageByNodeId(nodes.map((node) => node.id));
    return { nodes: nodes.map((node) => toApiNode(node, usage.get(node.id))) };
  });

  app.get('/:id/telemetry', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { range?: string };
    const range = (['1h', '1d', '1w', '1m'] as const).includes(query.range as TelemetryRange)
      ? (query.range as TelemetryRange)
      : '1h';

    const node = await prisma.node.findUnique({ where: { id }, select: { id: true } });
    if (!node) return reply.code(404).send({ error: 'Node not found' });

    const points = await telemetrySeries(id, range);
    return { range, points };
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const node = await prisma.node.findUnique({ where: { id } });
    if (!node) return reply.code(404).send({ error: 'Node not found' });
    const usage = await usageByNodeId([node.id]);
    return { node: toApiNode(node, usage.get(node.id)) };
  });

  app.post('/', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const parsed = createNodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid node payload', details: parsed.error.issues });
    }

    const existing = await prisma.node.findUnique({ where: { deviceId: parsed.data.deviceId } });
    if (existing) {
      return reply.code(409).send({ error: 'deviceId already exists' });
    }

    if (parsed.data.parentId) {
      const parent = await prisma.node.findUnique({ where: { id: parsed.data.parentId } });
      if (!parent) return reply.code(400).send({ error: 'Parent node not found' });
    }

    const node = await prisma.node.create({
      data: {
        deviceId: parsed.data.deviceId,
        name: parsed.data.name,
        location: parsed.data.location,
        parentId: parsed.data.parentId ?? null,
        dailyLimit: parsed.data.dailyLimit ?? 0,
        mode: parsed.data.mode ?? 'manual',
        schedule: parsed.data.schedule ?? {
          active: false,
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          openTime: '00:00',
          closeTime: '00:00',
        },
      },
    });

    await prisma.systemLog.create({
      data: {
        userId: request.user.sub,
        action: 'Add node',
        description: `${request.user.name} added node ${node.name} (${node.deviceId})`,
      },
    });
    invalidateNodeCache(node.deviceId);

    return reply.code(201).send({
      node: toApiNode(node),
      provisioning: {
        deviceId: node.deviceId,
        mqttHost: 'emqx.dtek.co.id',
        mqttPort: 1883,
        mqttWss: 'wss://mqtt.dtek.co.id',
        mqttUsername: 'pertamina-sfm',
        topicPrefix: `pertamina/sfm/${node.deviceId}`,
      },
    });
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = patchNodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid node payload', details: parsed.error.issues });
    }

    const current = await prisma.node.findUnique({ where: { id } });
    if (!current) return reply.code(404).send({ error: 'Node not found' });

    const isMetaChange =
      parsed.data.name !== undefined ||
      parsed.data.location !== undefined ||
      parsed.data.parentId !== undefined;

    if (isMetaChange && request.user.role !== 'super_admin') {
      return reply.code(403).send({ error: 'Only super admin can edit node metadata' });
    }

    const configTouched =
      parsed.data.dailyLimit !== undefined ||
      parsed.data.mode !== undefined ||
      parsed.data.schedule !== undefined;

    const { reason, ...nodeFields } = parsed.data;

    if (nodeFields.valveState) {
      if (!isMqttConnected()) {
        return reply.code(503).send({ error: 'MQTT broker not connected' });
      }
      publishCommand(
        current.deviceId,
        'valve',
        {
          command_id: randomUUID(),
          valve: nodeFields.valveState,
          ts: new Date().toISOString(),
        },
        false,
      );
    }

    const node = await prisma.node.update({
      where: { id },
      data: {
        ...nodeFields,
        configVersion: configTouched ? { increment: 1 } : undefined,
      },
    });
    invalidateNodeCache(node.deviceId);

    if (configTouched) {
      if (!isMqttConnected()) {
        return reply.code(503).send({ error: 'Config saved but MQTT broker not connected' });
      }
      publishCommand(
        node.deviceId,
        'config',
        {
          config_version: node.configVersion,
          mode: node.mode,
          daily_limit: node.dailyLimit,
          schedule: node.schedule,
        },
        true,
      );
    }

    const action = parsed.data.valveState
      ? 'Valve control from dashboard'
      : parsed.data.dailyLimit !== undefined
        ? 'Update limit'
        : parsed.data.schedule
          ? 'Update schedule'
          : 'Update node';

    const verb = parsed.data.valveState === 'open' ? 'opened' : parsed.data.valveState === 'closed' ? 'closed' : 'updated';
    const description = parsed.data.valveState
      ? `${request.user.name} ${verb} valve on ${node.name}: ${reason?.trim()}`
      : `${request.user.name} updated ${node.name}`;

    await prisma.systemLog.create({
      data: {
        userId: request.user.sub,
        action,
        description,
      },
    });

    const usage = await usageByNodeId([node.id]);
    return { node: toApiNode(node, usage.get(node.id)) };
  });

  app.post('/:id/dev', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const node = await prisma.node.findUnique({ where: { id } });
    if (!node) return reply.code(404).send({ error: 'Node not found' });

    if (!isMqttConnected()) {
      return reply.code(503).send({ error: 'MQTT broker not connected' });
    }

    publishCommand(
      node.deviceId,
      'dev',
      {
        command_id: randomUUID(),
        action: 'hybrid_ap',
        enable: true,
        ts: new Date().toISOString(),
      },
      false,
    );

    await prisma.systemLog.create({
      data: {
        userId: request.user.sub,
        action: 'Developer mode',
        description: `${request.user.name} enabled hybrid AP on ${node.name} (${node.deviceId})`,
      },
    });

    return { ok: true };
  });

  app.delete('/:id', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const current = await prisma.node.findUnique({ where: { id } });
    if (!current) return reply.code(404).send({ error: 'Node not found' });

    const childCount = await prisma.node.count({ where: { parentId: id } });
    if (childCount > 0) {
      return reply.code(400).send({ error: 'Reassign or delete child nodes first' });
    }

    await prisma.node.delete({ where: { id } });
    invalidateNodeCache(current.deviceId);
    await prisma.systemLog.create({
      data: {
        userId: request.user.sub,
        action: 'Delete node',
        description: `${request.user.name} deleted node ${current.name} (${current.deviceId})`,
      },
    });

    return { ok: true };
  });
}
