export type NodeStatus = 'online' | 'offline' | 'warning';
export type ValveState = 'open' | 'closed';
export type NodeMode = 'manual' | 'automatic';

export interface NodeSchedule {
  active: boolean;
  days: string[];
  openTime: string;
  closeTime: string;
}

export interface NodeAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  timestamp: string;
}

export interface NodeLog {
  id: string;
  timestamp: string;
  type: 'system' | 'valve' | 'limit' | 'schedule';
  nodeId: string;
  activity: string;
  status: 'success' | 'failed' | 'warning';
  description: string;
}

export interface SFMNode {
  id: string;
  deviceId?: string;
  name: string;
  location: string;
  parentId: string | null;
  status: NodeStatus;
  valveState: ValveState;
  mode: NodeMode;
  flowrate: number; // L/min
  todayUsage: number; // Liters
  dailyLimit: number; // Liters
  monthlyUsage: number; // Liters
  odometer: number; // Total Liters
  lastUpdate: string;
  statusChangedAt?: string;
  schedule: NodeSchedule;
  alerts: NodeAlert[];
}
