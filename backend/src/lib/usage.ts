import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { jakartaDayStart, jakartaMonthStart } from './jakarta.js';

export interface NodeUsage {
  todayUsage: number;
  monthlyUsage: number;
  odometer: number;
}

function roundLiters(value: number) {
  return Number(Number(value).toFixed(1));
}

export async function usageByNodeId(nodeIds: string[]): Promise<Map<string, NodeUsage>> {
  const today = jakartaDayStart();
  const month = jakartaMonthStart();
  const result = new Map<string, NodeUsage>();

  if (nodeIds.length === 0) return result;

  const idList = Prisma.join(nodeIds.map((id) => Prisma.sql`${id}`));

  const rows = await prisma.$queryRaw<
    { nodeId: string; todayUsage: number; monthlyUsage: number; odometer: number }[]
  >`
    SELECT
      "nodeId",
      COALESCE(SUM("flowrateAvg") FILTER (WHERE "recordedAt" >= ${today}), 0) AS "todayUsage",
      COALESCE(SUM("flowrateAvg") FILTER (WHERE "recordedAt" >= ${month}), 0) AS "monthlyUsage",
      COALESCE(SUM("flowrateAvg"), 0) AS odometer
    FROM "TelemetryReading"
    WHERE "nodeId" IN (${idList})
    GROUP BY "nodeId"
  `;

  const byId = new Map(rows.map((row) => [row.nodeId, row]));
  for (const id of nodeIds) {
    const row = byId.get(id);
    result.set(id, {
      todayUsage: roundLiters(row?.todayUsage ?? 0),
      monthlyUsage: roundLiters(row?.monthlyUsage ?? 0),
      odometer: roundLiters(row?.odometer ?? 0),
    });
  }

  return result;
}
