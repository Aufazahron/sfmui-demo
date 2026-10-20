import { useEffect, useMemo, useState } from 'react';
import { Droplets, Activity, Droplet, ArrowUpRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTip,
  ResponsiveContainer,
  Brush,
} from 'recharts';

type ChartRange = '1h' | '1d' | '1w' | '1m';

const RANGE_LABELS: { id: ChartRange; label: string }[] = [
  { id: '1h', label: '1 jam' },
  { id: '1d', label: '1 hari' },
  { id: '1w', label: '1 minggu' },
  { id: '1m', label: '1 bulan' },
];

function brushWindow(range: ChartRange, length: number) {
  if (length <= 1) return { startIndex: 0, endIndex: Math.max(0, length - 1) };
  if (range === '1d') {
    const size = Math.min(60, length);
    return { startIndex: length - size, endIndex: length - 1 };
  }
  const size = Math.max(1, Math.ceil(length / 3));
  return { startIndex: length - size, endIndex: length - 1 };
}

import { getNodes } from '@/services/nodes';
import { fetchSystemFlow } from '@/services/nodesApi';
import { applyLivePatch, useLiveTelemetry } from '@/context/LiveTelemetryContext';
import type { SFMNode } from '@/types';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: string;
  trendUp?: boolean;
  sub?: string;
}

function StatCard({ label, value, unit, icon, iconBg, trend, trendUp, sub }: StatCardProps) {
  return (
    <div className="sfm-card p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="sfm-stat-icon" style={{ background: iconBg }}>
          {icon}
        </div>
        {trend && (
          <span
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: trendUp ? '#1a7a3c' : '#ba1a1a' }}
          >
            <ArrowUpRight className="w-3 h-3" style={{ transform: trendUp ? '' : 'rotate(90deg)' }} />
            {trend}
          </span>
        )}
      </div>
      <div className="sfm-label-caps mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="sfm-data-value">{value}</span>
        {unit && <span className="sfm-data-unit">{unit}</span>}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: '#45474c' }}>{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="sfm-card px-3 py-2 text-sm">
      <div className="sfm-label-caps mb-1">{label}</div>
      <div className="font-bold" style={{ color: '#00687a' }}>{payload[0]?.value} L/min</div>
    </div>
  );
}

export default function Dashboard() {
  const { patches, flowSeries } = useLiveTelemetry();
  const [nodes, setNodes] = useState<SFMNode[]>([]);
  const [chartRange, setChartRange] = useState<ChartRange>('1h');
  const [historyPoints, setHistoryPoints] = useState<{ time: string; usage: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void getNodes()
      .then((data) => {
        if (alive) setNodes(data);
      })
      .catch(() => {
        if (alive) setNodes([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setChartLoading(true);
    void fetchSystemFlow(chartRange)
      .then((data) => {
        if (!alive) return;
        setHistoryPoints(data.points.map((point) => ({ time: point.t, usage: point.flow })));
      })
      .catch(() => {
        if (alive) setHistoryPoints([]);
      })
      .finally(() => {
        if (alive) setChartLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [chartRange]);

  const liveNodes = useMemo(
    () => nodes.map((node) => applyLivePatch(node, patches)),
    [nodes, patches],
  );

  const stats = useMemo(() => {
    const total = liveNodes.length;
    const online = liveNodes.filter(n => n.status !== 'offline').length;
    const offlineCount = liveNodes.filter(n => n.status === 'offline').length;
    const roots = liveNodes.filter(n => n.parentId === null || !liveNodes.some(p => p.id === n.parentId));
    const todayUsage = roots.reduce((a, n) => a + n.todayUsage, 0);
    const totalFlow = roots.reduce((a, n) => a + n.flowrate, 0);
    return { total, online, offline: offlineCount, todayUsage, totalFlow };
  }, [liveNodes]);

  const chartPoints = useMemo(() => {
    if (chartRange !== '1h' || flowSeries.length === 0) return historyPoints;
    return [...historyPoints, ...flowSeries];
  }, [chartRange, historyPoints, flowSeries]);

  const brush = useMemo(
    () => brushWindow(chartRange, historyPoints.length),
    [chartRange, historyPoints.length],
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Flow"
          value={stats.totalFlow.toFixed(1)}
          unit="L/min"
          iconBg="rgba(87,223,254,0.15)"
          icon={<Droplet className="w-5 h-5" style={{ color: '#00687a' }} />}
        />
        <StatCard
          label="Total Water Today"
          value={stats.todayUsage.toLocaleString()}
          unit="L"
          iconBg="rgba(76,141,255,0.12)"
          icon={<Droplets className="w-5 h-5" style={{ color: '#004395' }} />}
        />
        <StatCard
          label="Online Nodes"
          value={`${stats.online} / ${stats.total}`}
          iconBg="rgba(26,122,60,0.12)"
          icon={<Activity className="w-5 h-5" style={{ color: '#1a7a3c' }} />}
          sub={stats.offline > 0 ? `${stats.offline} offline` : 'All nodes active'}
        />
      </div>

      <div className="sfm-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h2 className="font-semibold text-base" style={{ color: '#0d1c2d' }}>
            Real-time System Flow
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {RANGE_LABELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setChartRange(item.id)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={
                    chartRange === item.id
                      ? { background: '#57dffe', color: '#091426' }
                      : { background: '#eef4ff', color: '#45474c' }
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
            <a
              href="/reports"
              className="text-sm font-medium flex items-center gap-1"
              style={{ color: '#00687a' }}
            >
              Details <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
        <div className="h-[400px]">
          {chartLoading ? (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: '#75777d' }}>
              Loading…
            </div>
          ) : chartPoints.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: '#75777d' }}>
              Belum ada data untuk rentang ini
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#57dffe" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#57dffe" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#75777d', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: '#75777d', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <RechartsTip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="usage"
                  stroke="#57dffe"
                  strokeWidth={3}
                  fill="url(#flowGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#00687a', stroke: '#fff', strokeWidth: 2 }}
                />
                {chartRange !== '1h' && (
                  <Brush
                    key={`${chartRange}-${historyPoints.length}`}
                    dataKey="time"
                    height={24}
                    stroke="#00687a"
                    fill="#eef4ff"
                    travellerWidth={8}
                    startIndex={brush.startIndex}
                    endIndex={brush.endIndex}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
