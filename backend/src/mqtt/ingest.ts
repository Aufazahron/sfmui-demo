import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { env } from '../env.js';
import { usageByNodeId, type NodeUsage } from '../lib/usage.js';
import { broadcastLive } from '../ws/hub.js';

const liveSchema = z.object({
  ts: z.string().optional(),
  flowrate: z.coerce.number(),
  odometer: z.coerce.number().optional(),
});

const minuteSchema = z.object({
  seq: z.coerce.number().int(),
  recorded_at: z.string(),
  flowrate_avg: z.coerce.number(),
  odometer: z.coerce.number(),
});

const backlogSchema = z.object({
  from_seq: z.coerce.number().int().optional(),
  to_seq: z.coerce.number().int().optional(),
  readings: z.array(minuteSchema).min(1),
});

const valveSchema = z.object({
  ts: z.string().optional(),
  valve: z.enum(['open', 'closed']),
  cause: z.enum(['command', 'schedule', 'limit', 'manual']).optional(),
});

const heartbeatSchema = z.object({
  ts: z.string().optional(),
  uptime_s: z.coerce.number().optional(),
  config_version: z.coerce.number().int().optional(),
});

const lwtSchema = z.object({
  status: z.enum(['online', 'offline']),
});

const configAckSchema = z.object({
  ts: z.string().optional(),
  config_version: z.coerce.number().int(),
});

type CachedNode = {
  id: string;
  name: string;
  deviceId: string;
  status: 'online' | 'offline' | 'warning';
  lastTelemetrySeq: number;
  configVersion: number;
  mode: 'manual' | 'automatic';
  dailyLimit: number;
  schedule: unknown;
};

const LIVE_OFFLINE_MS = 5_000;
const PRESENCE_OFFLINE_MS = 90_000;
const DB_TOUCH_MS = 20_000;
const DB_STALE_SWEEP_MS = 30_000;

const nodeCache = new Map<string, CachedNode>();
const lastLiveAt = new Map<string, number>();
const lastPresenceAt = new Map<string, number>();
const lastDbTouch = new Map<string, number>();

let staleCheckRunning = false;
let lastDbSweep = 0;

export const STALE_CHECK_MS = 1_000;

function touchPresence(nodeId: string, live = false) {
  const now = Date.now();
  lastPresenceAt.set(nodeId, now);
  if (live) lastLiveAt.set(nodeId, now);
}

function clearPresence(nodeId: string) {
  lastLiveAt.delete(nodeId);
  lastPresenceAt.delete(nodeId);
  lastDbTouch.delete(nodeId);
}

export function invalidateNodeCache(deviceId?: string) {
  if (deviceId) nodeCache.delete(deviceId);
  else nodeCache.clear();
}

function parseTopic(topic: string) {
  const prefix = `${env.MQTT_TOPIC_PREFIX}/`;
  if (!topic.startsWith(prefix)) return null;
  const parts = topic.slice(prefix.length).split('/');
  if (parts.length < 2) return null;
  const [deviceId, ...path] = parts;
  return { deviceId, kind: path.join('/') };
}

function flowTotalsPatch(totals?: NodeUsage) {
  if (!totals) return {};
  return {
    odometer: totals.odometer,
    todayUsage: totals.todayUsage,
    monthlyUsage: totals.monthlyUsage,
  };
}

function parseJson(payload: Buffer) {
  try {
    return JSON.parse(payload.toString());
  } catch {
    return null;
  }
}

async function getNode(deviceId: string) {
  const cached = nodeCache.get(deviceId);
  if (cached) return cached;
  const node = await prisma.node.findUnique({
    where: { deviceId },
    select: {
      id: true,
      name: true,
      deviceId: true,
      status: true,
      lastTelemetrySeq: true,
      configVersion: true,
      mode: true,
      dailyLimit: true,
      schedule: true,
    },
  });
  if (!node) return null;
  const entry: CachedNode = {
    id: node.id,
    name: node.name,
    deviceId: node.deviceId,
    status: node.status,
    lastTelemetrySeq: node.lastTelemetrySeq,
    configVersion: node.configVersion,
    mode: node.mode,
    dailyLimit: node.dailyLimit,
    schedule: node.schedule,
  };
  nodeCache.set(deviceId, entry);
  return entry;
}

async function markOnline(node: CachedNode, lastSeenAt = new Date()) {
  const wasOffline = node.status !== 'online';
  await prisma.node.update({
    where: { id: node.id },
    data: {
      status: 'online',
      lastSeenAt,
      ...(wasOffline ? { statusChangedAt: lastSeenAt } : {}),
    },
  });
  node.status = 'online';
  if (wasOffline) {
    await prisma.deviceLog.create({
      data: {
        nodeId: node.id,
        type: 'online',
        action: 'Node online',
        description: `${node.name} is online and connected`,
      },
    });
    broadcastLive({
      type: 'node',
      nodeId: node.id,
      deviceId: node.deviceId,
      patch: {
        status: 'online',
        lastUpdate: lastSeenAt.toISOString(),
        statusChangedAt: lastSeenAt.toISOString(),
      },
    });
    await publishSyncState(node);
  }
}

async function markOffline(node: CachedNode) {
  if (node.status === 'offline') return;
  clearPresence(node.id);
  const now = new Date();
  await prisma.node.update({
    where: { id: node.id },
    data: { status: 'offline', lastSeenAt: now, statusChangedAt: now },
  });
  node.status = 'offline';
  await prisma.deviceLog.create({
    data: {
      nodeId: node.id,
      type: 'offline',
      action: 'Node offline',
      description: `${node.name} is not connected`,
    },
  });
  broadcastLive({
    type: 'node',
    nodeId: node.id,
    deviceId: node.deviceId,
    patch: {
      status: 'offline',
      lastUpdate: now.toISOString(),
      statusChangedAt: now.toISOString(),
    },
  });
}

async function publishSyncState(node: CachedNode) {
  try {
    const lastReading = await prisma.telemetryReading.findFirst({
      where: { nodeId: node.id },
      orderBy: { recordedAt: 'desc' },
      select: { recordedAt: true },
    });
    const { publishCommand } = await import('./client.js');
    publishCommand(
      node.deviceId,
      'sync',
      {
        last_seq: node.lastTelemetrySeq,
        last_recorded_at: lastReading?.recordedAt.toISOString() ?? null,
        config_version: node.configVersion,
        mode: node.mode,
        daily_limit: node.dailyLimit,
        schedule: node.schedule,
      },
      false,
    );
  } catch (err) {
    console.warn('[mqtt] sync/state failed', node.deviceId, err instanceof Error ? err.message : err);
  }
}

async function upsertReading(
  node: CachedNode,
  reading: z.infer<typeof minuteSchema>,
  source: 'minute' | 'backlog',
) {
  const recordedAt = new Date(reading.recorded_at);
  if (Number.isNaN(recordedAt.getTime())) return;

  await prisma.telemetryReading.upsert({
    where: { nodeId_recordedAt: { nodeId: node.id, recordedAt } },
    create: {
      nodeId: node.id,
      recordedAt,
      flowrateAvg: reading.flowrate_avg,
      odometer: reading.odometer,
      seq: reading.seq,
      source,
    },
    update: {
      flowrateAvg: reading.flowrate_avg,
      odometer: reading.odometer,
      seq: reading.seq,
      ...(source === 'minute' ? { source: 'minute' as const } : {}),
    },
  });

  const nextSeq = Math.max(node.lastTelemetrySeq, reading.seq);
  const becameOnline = node.status !== 'online';
  const seenAt = new Date();
  await prisma.node.update({
    where: { id: node.id },
    data: {
      lastFlowrate: reading.flowrate_avg,
      lastTelemetrySeq: nextSeq,
      lastSeenAt: seenAt,
      status: 'online',
      ...(becameOnline ? { statusChangedAt: seenAt } : {}),
    },
  });
  node.lastTelemetrySeq = nextSeq;
  node.status = 'online';
}

async function applyFlowTotals(node: CachedNode): Promise<NodeUsage | undefined> {
  const totals = (await usageByNodeId([node.id])).get(node.id);
  if (totals) {
    await prisma.node.update({
      where: { id: node.id },
      data: { lastOdometer: totals.odometer },
    });
  }
  return totals;
}

export async function handleMqttMessage(topic: string, payload: Buffer) {
  const parsedTopic = parseTopic(topic);
  if (!parsedTopic) return;

  const { deviceId, kind } = parsedTopic;
  if (kind === 'command/valve' || kind === 'command/config' || kind === 'command/dev' || kind === 'sync/state') return;

  const json = parseJson(payload);
  if (!json) return;

  const node = await getNode(deviceId);
  if (!node) {
    if (process.env.MQTT_DEBUG === '1') {
      console.warn('[mqtt] unknown deviceId', deviceId, kind);
    }
    return;
  }

  try {
    if (kind === 'telemetry/live') {
      const data = liveSchema.parse(json);
      const ts = data.ts ?? new Date().toISOString();
      touchPresence(node.id, true);
      if (node.status !== 'online') {
        await markOnline(node);
      } else {
        const now = Date.now();
        if ((lastDbTouch.get(node.id) ?? 0) + DB_TOUCH_MS < now) {
          lastDbTouch.set(node.id, now);
          void prisma.node.update({
            where: { id: node.id },
            data: {
              lastSeenAt: new Date(),
              lastFlowrate: data.flowrate,
              status: 'online',
            },
          });
        }
      }
      broadcastLive({
        type: 'live',
        nodeId: node.id,
        deviceId,
        flowrate: data.flowrate,
        ts,
      });
      return;
    }

    if (kind === 'telemetry/minute') {
      const data = minuteSchema.parse(json);
      touchPresence(node.id);
      if (node.status !== 'online') {
        await markOnline(node);
      }
      broadcastLive({
        type: 'node',
        nodeId: node.id,
        deviceId,
        patch: {
          status: 'online',
          flowrate: data.flowrate_avg,
          lastUpdate: data.recorded_at,
        },
      });
      void upsertReading(node, data, 'minute')
        .then(() => applyFlowTotals(node))
        .then((totals) => {
          broadcastLive({
            type: 'node',
            nodeId: node.id,
            deviceId,
            patch: {
              status: 'online',
              flowrate: data.flowrate_avg,
              ...flowTotalsPatch(totals),
              lastUpdate: data.recorded_at,
            },
          });
          broadcastLive({ type: 'telemetry', nodeId: node.id });
        })
        .catch((err) => {
          console.error('[mqtt] minute upsert failed', deviceId, err instanceof Error ? err.message : err);
        });
      return;
    }

    if (kind === 'telemetry/backlog') {
      const data = backlogSchema.parse(json);
      touchPresence(node.id);
      const last = data.readings[data.readings.length - 1];
      void (async () => {
        for (const reading of data.readings) {
          await upsertReading(node, reading, 'backlog');
        }
        const totals = await applyFlowTotals(node);
        if (last) {
          broadcastLive({
            type: 'node',
            nodeId: node.id,
            deviceId,
            patch: {
              status: 'online',
              flowrate: last.flowrate_avg,
              ...flowTotalsPatch(totals),
              lastUpdate: last.recorded_at,
            },
          });
        }
        broadcastLive({ type: 'telemetry', nodeId: node.id });
      })().catch((err) => {
        console.error('[mqtt] backlog upsert failed', deviceId, err instanceof Error ? err.message : err);
      });
      return;
    }

    if (kind === 'status/heartbeat') {
      heartbeatSchema.parse(json);
      touchPresence(node.id);
      await markOnline(node);
      return;
    }

    if (kind === 'status/lwt') {
      const data = lwtSchema.parse(json);
      if (data.status === 'offline') {
        await markOffline(node);
      } else {
        const fresh = await prisma.node.findUnique({
          where: { id: node.id },
          select: {
            lastTelemetrySeq: true,
            configVersion: true,
            mode: true,
            dailyLimit: true,
            schedule: true,
          },
        });
        if (fresh) {
          node.lastTelemetrySeq = fresh.lastTelemetrySeq;
          node.configVersion = fresh.configVersion;
          node.mode = fresh.mode;
          node.dailyLimit = fresh.dailyLimit;
          node.schedule = fresh.schedule;
        }
        touchPresence(node.id);
        await markOnline(node);
        await publishSyncState(node);
      }
      return;
    }

    if (kind === 'status/valve') {
      const data = valveSchema.parse(json);
      touchPresence(node.id);
      const becameOnline = node.status !== 'online';
      const seenAt = new Date();
      await prisma.node.update({
        where: { id: node.id },
        data: {
          valveState: data.valve,
          lastSeenAt: seenAt,
          status: 'online',
          ...(becameOnline ? { statusChangedAt: seenAt } : {}),
        },
      });
      node.status = 'online';
      await prisma.deviceLog.create({
        data: {
          nodeId: node.id,
          type: data.cause === 'limit' ? 'limit' : data.cause === 'schedule' ? 'schedule' : 'valve',
          action: 'Valve status changed',
          description: `${node.name} valve ${data.valve}${data.cause ? ` (${data.cause})` : ''}`,
        },
      });
      const lastUpdate = data.ts ?? seenAt.toISOString();
      broadcastLive({
        type: 'node',
        nodeId: node.id,
        deviceId,
        patch: {
          status: 'online',
          valveState: data.valve,
          lastUpdate,
          ...(becameOnline ? { statusChangedAt: seenAt.toISOString() } : {}),
        },
      });
      return;
    }

    if (kind === 'command/config/ack') {
      const data = configAckSchema.parse(json);
      touchPresence(node.id);
      await prisma.node.update({
        where: { id: node.id },
        data: { configAckedVersion: data.config_version, lastSeenAt: new Date() },
      });
    }
  } catch (err) {
    console.error('[mqtt] ingest failed', topic, err instanceof Error ? err.message : err);
  }
}

export async function markStaleNodesOffline() {
  if (staleCheckRunning) return;
  staleCheckRunning = true;
  try {
    const now = Date.now();

    for (const node of nodeCache.values()) {
      if (node.status === 'offline') continue;
      const liveAt = lastLiveAt.get(node.id);
      if (liveAt != null && now - liveAt > LIVE_OFFLINE_MS) {
        await markOffline(node);
        continue;
      }
      const presenceAt = lastPresenceAt.get(node.id);
      if (liveAt == null && presenceAt != null && now - presenceAt > PRESENCE_OFFLINE_MS) {
        await markOffline(node);
      }
    }

    if (now - lastDbSweep < DB_STALE_SWEEP_MS) return;
    lastDbSweep = now;

    const cutoff = new Date(now - PRESENCE_OFFLINE_MS);
    const stale = await prisma.node.findMany({
      where: {
        status: { not: 'offline' },
        lastSeenAt: { lt: cutoff },
      },
      select: { id: true, name: true, deviceId: true },
    });

    for (const node of stale) {
      const cached = nodeCache.get(node.deviceId) ?? {
        id: node.id,
        name: node.name,
        deviceId: node.deviceId,
        status: 'online' as const,
        lastTelemetrySeq: 0,
        configVersion: 1,
        mode: 'manual' as const,
        dailyLimit: 0,
        schedule: {},
      };
      nodeCache.set(node.deviceId, cached);
      await markOffline(cached);
    }
  } finally {
    staleCheckRunning = false;
  }
}
