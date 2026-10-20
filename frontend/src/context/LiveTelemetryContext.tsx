import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { expireSession, getAccessToken, refreshSession } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { NodeStatus, ValveState } from '@/types';

export type LivePatch = {
  status?: NodeStatus;
  valveState?: ValveState;
  flowrate?: number;
  odometer?: number;
  todayUsage?: number;
  monthlyUsage?: number;
  lastUpdate?: string;
  statusChangedAt?: string;
};

export type SparkPoint = { t: string; v: number };

type LiveMessage =
  | { type: 'live'; nodeId: string; deviceId: string; flowrate: number; odometer?: number; ts: string }
  | { type: 'node'; nodeId: string; deviceId: string; patch: LivePatch }
  | { type: 'telemetry'; nodeId: string };

interface LiveContextValue {
  patches: Record<string, LivePatch>;
  flowSeries: { time: string; usage: number }[];
  sparklines: Record<string, SparkPoint[]>;
  telemetryTicks: Record<string, number>;
}

const LiveContext = createContext<LiveContextValue>({
  patches: {},
  flowSeries: [],
  sparklines: {},
  telemetryTicks: {},
});

function wsUrl(token: string) {
  const api = import.meta.env.VITE_API_URL;
  if (api) {
    const base = api.replace(/^http/, 'ws').replace(/\/$/, '');
    return `${base}/api/ws?token=${encodeURIComponent(token)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws?token=${encodeURIComponent(token)}`;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [patches, setPatches] = useState<Record<string, LivePatch>>({});
  const [flowSeries, setFlowSeries] = useState<{ time: string; usage: number }[]>([]);
  const [sparklines, setSparklines] = useState<Record<string, SparkPoint[]>>({});
  const [telemetryTicks, setTelemetryTicks] = useState<Record<string, number>>({});
  const flowrates = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;

    let closed = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      if (closed) return;
      let token = getAccessToken();
      if (!token) {
        const ok = await refreshSession();
        if (!ok) {
          expireSession();
          return;
        }
        token = getAccessToken();
      }
      if (!token) {
        expireSession();
        return;
      }

      socket = new WebSocket(wsUrl(token));
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as LiveMessage;
          if (msg.type === 'live') {
            flowrates.current[msg.nodeId] = msg.flowrate;
            const total = Object.values(flowrates.current).reduce((sum, value) => sum + value, 0);
            const time = new Date(msg.ts).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Asia/Jakarta',
            });
            setFlowSeries((prev) => [...prev.slice(-59), { time, usage: Number(total.toFixed(1)) }]);
            setSparklines((prev) => {
              const next = [...(prev[msg.nodeId] ?? []), { t: time, v: msg.flowrate }].slice(-60);
              return { ...prev, [msg.nodeId]: next };
            });
            setPatches((prev) => {
              const previous = prev[msg.nodeId];
              const becameOnline = previous?.status && previous.status !== 'online';
              return {
                ...prev,
                [msg.nodeId]: {
                  ...previous,
                  flowrate: msg.flowrate,
                  status: 'online',
                  lastUpdate: msg.ts,
                  ...(becameOnline ? { statusChangedAt: msg.ts } : {}),
                },
              };
            });
            return;
          }
          if (msg.type === 'node') {
            if (typeof msg.patch.flowrate === 'number') {
              flowrates.current[msg.nodeId] = msg.patch.flowrate;
            }
            setPatches((prev) => ({
              ...prev,
              [msg.nodeId]: { ...prev[msg.nodeId], ...msg.patch },
            }));
            return;
          }
          if (msg.type === 'telemetry') {
            setTelemetryTicks((prev) => ({
              ...prev,
              [msg.nodeId]: (prev[msg.nodeId] ?? 0) + 1,
            }));
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = (event) => {
        if (closed) return;
        if (event.code === 1008) {
          void (async () => {
            const ok = await refreshSession();
            if (!ok) {
              expireSession();
              return;
            }
            retry = setTimeout(() => void connect(), 0);
          })();
          return;
        }
        retry = setTimeout(() => void connect(), 3000);
      };
    };

    void connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [user]);

  const value = useMemo(
    () => ({ patches, flowSeries, sparklines, telemetryTicks }),
    [patches, flowSeries, sparklines, telemetryTicks],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLiveTelemetry() {
  return useContext(LiveContext);
}

export function applyLivePatch<T extends { id: string }>(
  node: T,
  patches: Record<string, LivePatch>,
): T {
  const patch = patches[node.id];
  if (!patch) return node;
  return { ...node, ...patch };
}
