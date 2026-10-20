import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { jakartaDayStart, jakartaMonthStart } from './jakarta.js';

export type TelemetryRange = '1h' | '1d' | '1w' | '1m';

export interface TelemetryPoint {
  t: string;
  flow: number;
}

function rangeWindow(range: TelemetryRange) {
  const now = Date.now();
  if (range === '1h') return { from: new Date(now - 60 * 60 * 1000), trunc: 'minute' as const };
  if (range === '1d') return { from: new Date(now - 24 * 60 * 60 * 1000), trunc: 'hour' as const };
  if (range === '1w') return { from: new Date(now - 7 * 24 * 60 * 60 * 1000), trunc: 'day' as const };
  return { from: new Date(now - 30 * 24 * 60 * 60 * 1000), trunc: 'day' as const };
}

function labelFor(date: Date, range: TelemetryRange) {
  if (range === '1h') {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });
  }
  if (range === '1d') {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });
  }
  return date.toLocaleDateString('en-CA', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

export async function telemetrySeries(nodeId: string, range: TelemetryRange): Promise<TelemetryPoint[]> {
  const { from, trunc } = rangeWindow(range);

  if (range === '1h') {
    const rows = await prisma.telemetryReading.findMany({
      where: { nodeId, recordedAt: { gte: from } },
      orderBy: { recordedAt: 'asc' },
      select: { recordedAt: true, flowrateAvg: true },
    });
    return rows.map((row) => ({
      t: labelFor(row.recordedAt, range),
      flow: Number(row.flowrateAvg.toFixed(2)),
    }));
  }

  const truncExpr = trunc === 'hour' ? Prisma.raw(`'hour'`) : Prisma.raw(`'day'`);
  const rows = await prisma.$queryRaw<{ bucket: Date; flow: number }[]>`
    SELECT
      date_trunc(${truncExpr}, "recordedAt" AT TIME ZONE 'Asia/Jakarta')
        AT TIME ZONE 'Asia/Jakarta' AS bucket,
      AVG("flowrateAvg") AS flow
    FROM "TelemetryReading"
    WHERE "nodeId" = ${nodeId} AND "recordedAt" >= ${from}
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map((row) => ({
    t: labelFor(new Date(row.bucket), range),
    flow: Number(Number(row.flow).toFixed(2)),
  }));
}

function jakartaMinuteKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

function systemFlowLabel(date: Date, range: TelemetryRange) {
  if (range === '1h') return labelFor(date, '1h');
  if (range === '1m') return labelFor(date, '1m');
  return date.toLocaleString('en-GB', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  });
}

function sumNodeAverages(
  rows: { nodeId: string; recordedAt: Date; flowrateAvg: number }[],
  bucketKey: (date: Date) => string,
) {
  const perNodeBucket = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const key = `${row.nodeId}|${bucketKey(row.recordedAt)}`;
    const current = perNodeBucket.get(key) ?? { sum: 0, count: 0 };
    current.sum += row.flowrateAvg;
    current.count += 1;
    perNodeBucket.set(key, current);
  }

  const byBucket = new Map<string, number>();
  for (const [key, { sum, count }] of perNodeBucket) {
    const bucket = key.slice(key.indexOf('|') + 1);
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + sum / count);
  }
  return byBucket;
}

function fillSeries(
  byBucket: Map<string, number>,
  range: TelemetryRange,
  steps: number,
  stepMs: number,
  bucketKey: (date: Date) => string,
) {
  const now = Date.now();
  const points: TelemetryPoint[] = [];
  for (let i = steps - 1; i >= 0; i -= 1) {
    const date = new Date(now - i * stepMs);
    points.push({
      t: systemFlowLabel(date, range),
      flow: Number((byBucket.get(bucketKey(date)) ?? 0).toFixed(2)),
    });
  }
  return points;
}

export async function systemFlowSeries(range: TelemetryRange = '1h'): Promise<TelemetryPoint[]> {
  const { from } = rangeWindow(range);

  if (range === '1h' || range === '1d') {
    const rows = await prisma.telemetryReading.findMany({
      where: { recordedAt: { gte: from } },
      select: { nodeId: true, recordedAt: true, flowrateAvg: true },
    });
    const byMinute = sumNodeAverages(rows, jakartaMinuteKey);
    const steps = range === '1h' ? 60 : 24 * 60;
    return fillSeries(byMinute, range, steps, 60 * 1000, jakartaMinuteKey);
  }

  const trunc = range === '1w' ? 'hour' : 'day';
  const truncExpr = trunc === 'hour' ? Prisma.raw(`'hour'`) : Prisma.raw(`'day'`);
  const rows = await prisma.$queryRaw<{ nodeId: string; bucket: Date; flow: number }[]>`
    SELECT
      "nodeId",
      date_trunc(${truncExpr}, "recordedAt" AT TIME ZONE 'Asia/Jakarta')
        AT TIME ZONE 'Asia/Jakarta' AS bucket,
      AVG("flowrateAvg") AS flow
    FROM "TelemetryReading"
    WHERE "recordedAt" >= ${from}
    GROUP BY 1, 2
  `;

  const byBucket = new Map<string, number>();
  for (const row of rows) {
    const key = jakartaBucketKey(new Date(row.bucket), trunc);
    byBucket.set(key, (byBucket.get(key) ?? 0) + Number(row.flow));
  }

  const steps = range === '1w' ? 7 * 24 : 30;
  const stepMs = trunc === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return fillSeries(byBucket, range, steps, stepMs, (date) => jakartaBucketKey(date, trunc));
}

export type ReportPeriod = 'today' | '7days' | '30days';

export interface ReportNodeUsage {
  id: string;
  name: string;
  usage: number;
}

export interface UsageReport {
  period: ReportPeriod;
  trend: { time: string; usage: number }[];
  nodes: ReportNodeUsage[];
  stats: {
    totalUsage: number;
    average: number;
    averageUnit: 'hour' | 'day';
    highest: ReportNodeUsage | null;
    lowest: ReportNodeUsage | null;
  };
}

function jakartaBucketKey(date: Date, trunc: 'hour' | 'day') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((part) => part.type === type)?.value ?? '').padStart(2, '0');
  const day = `${parts.find((part) => part.type === 'year')?.value ?? ''}-${get('month')}-${get('day')}`;
  const hour = get('hour') === '24' ? '00' : get('hour');
  return trunc === 'day' ? day : `${day} ${hour}`;
}

function bucketLabel(date: Date, trunc: 'hour' | 'day') {
  if (trunc === 'hour') {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Jakarta',
    });
  }
  return date.toLocaleDateString('en-CA', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
}

function parseHour(value: string | undefined, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  if (!match) return fallback;
  return Math.min(23, Math.max(0, Number(match[1])));
}

function reportWindow(period: ReportPeriod) {
  const now = new Date();
  if (period === 'today') {
    return { from: jakartaDayStart(now), until: now, trunc: 'hour' as const };
  }
  if (period === '7days') {
    const start = jakartaDayStart(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    return { from: start, until: now, trunc: 'day' as const };
  }
  return { from: jakartaMonthStart(now), until: now, trunc: 'day' as const };
}

function buildBuckets(from: Date, until: Date, trunc: 'hour' | 'day') {
  const step = trunc === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const buckets: Date[] = [];
  for (let t = from.getTime(); t <= until.getTime(); t += step) {
    buckets.push(new Date(t));
  }
  return buckets;
}

export async function usageReport(opts: {
  period: ReportPeriod;
  nodeId?: string;
  fromTime?: string;
  toTime?: string;
}): Promise<UsageReport> {
  const { period } = opts;
  const { from, until, trunc } = reportWindow(period);
  const fromHour = parseHour(opts.fromTime, 0);
  const toHour = parseHour(opts.toTime, 23);

  const dbNodes = await prisma.node.findMany({
    select: { id: true, name: true, parentId: true },
    orderBy: { createdAt: 'asc' },
  });
  const nodeIds = new Set(dbNodes.map((node) => node.id));
  const roots = dbNodes.filter((node) => !node.parentId || !nodeIds.has(node.parentId));
  const rootIds = new Set(roots.map((node) => node.id));

  let buckets = buildBuckets(from, until, trunc);
  if (period === 'today') {
    buckets = buckets.filter((date) => {
      const hour = Number(jakartaBucketKey(date, 'hour').slice(-2));
      return hour >= fromHour && hour <= toHour;
    });
  }

  const emptyStats = {
    totalUsage: 0,
    average: 0,
    averageUnit: (trunc === 'hour' ? 'hour' : 'day') as 'hour' | 'day',
    highest: null,
    lowest: null,
  };

  if (dbNodes.length === 0) {
    return {
      period,
      trend: buckets.map((date) => ({ time: bucketLabel(date, trunc), usage: 0 })),
      nodes: [],
      stats: emptyStats,
    };
  }

  const fmt = trunc === 'hour' ? Prisma.raw(`'YYYY-MM-DD HH24'`) : Prisma.raw(`'YYYY-MM-DD'`);
  const bucketRows = await prisma.$queryRaw<{ nodeId: string; bucket: string; usage: number }[]>`
    SELECT
      "nodeId",
      to_char(timezone('Asia/Jakarta', "recordedAt"), ${fmt}) AS bucket,
      SUM("flowrateAvg") AS usage
    FROM "TelemetryReading"
    WHERE "recordedAt" >= ${from} AND "recordedAt" <= ${until}
    GROUP BY 1, 2
  `;

  const usageLookup = new Map<string, number>();
  for (const row of bucketRows) {
    usageLookup.set(`${row.nodeId}|${row.bucket}`, Number(row.usage));
  }

  const usageByNodeBucket = new Map<string, number[]>();
  for (const node of dbNodes) {
    usageByNodeBucket.set(
      node.id,
      buckets.map((date) => {
        const bucketKey = jakartaBucketKey(date, trunc);
        return Number((usageLookup.get(`${node.id}|${bucketKey}`) ?? 0).toFixed(1));
      }),
    );
  }

  const selectedIds = opts.nodeId && nodeIds.has(opts.nodeId)
    ? [opts.nodeId]
    : roots.map((node) => node.id);

  const trend = buckets.map((date, index) => ({
    time: bucketLabel(date, trunc),
    usage: Number(
      selectedIds
        .reduce((sum, id) => sum + (usageByNodeBucket.get(id)?.[index] ?? 0), 0)
        .toFixed(1),
    ),
  }));

  const nodes: ReportNodeUsage[] = dbNodes.map((node) => ({
    id: node.id,
    name: node.name,
    usage: Number((usageByNodeBucket.get(node.id)?.reduce((sum, value) => sum + value, 0) ?? 0).toFixed(1)),
  }));

  const scopedNodes = opts.nodeId && nodeIds.has(opts.nodeId)
    ? nodes.filter((node) => node.id === opts.nodeId)
    : nodes;

  const totalUsage = Number(
    (opts.nodeId && nodeIds.has(opts.nodeId)
      ? scopedNodes[0]?.usage ?? 0
      : nodes.filter((node) => rootIds.has(node.id)).reduce((sum, node) => sum + node.usage, 0)
    ).toFixed(1),
  );

  const divisor = Math.max(1, buckets.length);
  const average = Number((totalUsage / divisor).toFixed(1));
  const ranked = [...scopedNodes].sort((a, b) => b.usage - a.usage);
  const hasUsage = ranked.some((node) => node.usage > 0);

  return {
    period,
    trend,
    nodes: scopedNodes,
    stats: {
      totalUsage,
      average,
      averageUnit: trunc === 'hour' ? 'hour' : 'day',
      highest: hasUsage ? ranked[0] : null,
      lowest: hasUsage ? ranked[ranked.length - 1] : null,
    },
  };
}
