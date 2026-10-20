import { apiFetch } from './api';
import type { NodeMode, NodeSchedule, SFMNode } from '@/types';

export interface ProvisioningInfo {
  deviceId: string;
  mqttHost: string;
  mqttPort: number;
  mqttWss: string;
  mqttUsername: string;
  topicPrefix: string;
}

export interface ApiNode {
  id: string;
  deviceId: string;
  name: string;
  location: string;
  parentId: string | null;
  status: SFMNode['status'];
  valveState: SFMNode['valveState'];
  mode: NodeMode;
  flowrate: number;
  todayUsage: number;
  dailyLimit: number;
  monthlyUsage: number;
  odometer: number;
  lastUpdate: string;
  statusChangedAt?: string;
  schedule: NodeSchedule;
  alerts: SFMNode['alerts'];
  configVersion?: number;
  configAckedVersion?: number;
  configSynced?: boolean;
}

export function mapApiNode(node: ApiNode): SFMNode {
  return {
    id: node.id,
    deviceId: node.deviceId,
    name: node.name,
    location: node.location,
    parentId: node.parentId,
    status: node.status,
    valveState: node.valveState,
    mode: node.mode,
    flowrate: node.flowrate,
    todayUsage: node.todayUsage,
    dailyLimit: node.dailyLimit,
    monthlyUsage: node.monthlyUsage,
    odometer: node.odometer,
    lastUpdate: node.lastUpdate,
    statusChangedAt: node.statusChangedAt,
    schedule: node.schedule,
    alerts: node.alerts ?? [],
  };
}

export async function createNode(payload: {
  deviceId: string;
  name: string;
  location: string;
  parentId?: string | null;
  dailyLimit?: number;
  mode?: NodeMode;
}) {
  return apiFetch('/api/nodes', {
    method: 'POST',
    body: payload,
  }) as Promise<{ node: ApiNode; provisioning: ProvisioningInfo }>;
}

export async function updateNodeApi(id: string, payload: {
  name?: string;
  location?: string;
  parentId?: string | null;
  dailyLimit?: number;
  mode?: NodeMode;
  valveState?: SFMNode['valveState'];
  reason?: string;
  schedule?: NodeSchedule;
}) {
  return apiFetch(`/api/nodes/${id}`, {
    method: 'PATCH',
    body: payload,
  }) as Promise<{ node: ApiNode }>;
}

export async function deleteNodeApi(id: string) {
  return apiFetch(`/api/nodes/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>;
}

export async function enableHybridAp(id: string) {
  return apiFetch(`/api/nodes/${id}/dev`, { method: 'POST' }) as Promise<{ ok: boolean }>;
}

export async function fetchApiNodes() {
  return apiFetch('/api/nodes') as Promise<{ nodes: ApiNode[] }>;
}

export async function fetchNodeTelemetry(id: string, range: '1h' | '1d' | '1w' | '1m') {
  return apiFetch(`/api/nodes/${id}/telemetry?range=${range}`) as Promise<{
    range: string;
    points: { t: string; flow: number }[];
  }>;
}

export async function fetchSystemFlow(range: '1h' | '1d' | '1w' | '1m' = '1h') {
  return apiFetch(`/api/telemetry/system-flow?range=${range}`) as Promise<{
    range: string;
    points: { t: string; flow: number }[];
  }>;
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

export async function fetchUsageReport(params: {
  period: ReportPeriod;
  nodeId?: string;
  fromTime?: string;
  toTime?: string;
}) {
  const query = new URLSearchParams();
  query.set('period', params.period);
  if (params.nodeId && params.nodeId !== 'all') query.set('nodeId', params.nodeId);
  if (params.fromTime) query.set('fromTime', params.fromTime);
  if (params.toTime) query.set('toTime', params.toTime);
  return apiFetch(`/api/telemetry/report?${query.toString()}`) as Promise<UsageReport>;
}
