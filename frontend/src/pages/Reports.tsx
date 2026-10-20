import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  ResponsiveContainer,
} from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadCsv } from '@/lib/downloadCsv';
import { getNodes } from '@/services/nodes';
import {
  fetchUsageReport,
  type ReportPeriod,
  type UsageReport,
} from '@/services/nodesApi';
import type { SFMNode } from '@/types';

const COLORS = ['#57dffe', '#4c8dff', '#00687a', '#c5c6cd', '#1a7a3c', '#ba1a1a', '#7e22ce'];

const PERIOD_LABEL: Record<ReportPeriod, string> = {
  today: 'Today',
  '7days': 'Last 7 Days',
  '30days': 'This Month',
};

function formatLiters(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const EMPTY_REPORT: UsageReport = {
  period: '7days',
  trend: [],
  nodes: [],
  stats: { totalUsage: 0, average: 0, averageUnit: 'day', highest: null, lowest: null },
};

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>('today');
  const [nodeFilter, setNodeFilter] = useState('all');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [nodes, setNodes] = useState<SFMNode[]>([]);
  const [report, setReport] = useState<UsageReport>(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    void fetchUsageReport({
      period,
      nodeId: nodeFilter,
      fromTime: period === 'today' ? startTime : undefined,
      toTime: period === 'today' ? endTime : undefined,
    })
      .then((data) => {
        if (alive) setReport(data);
      })
      .catch((err) => {
        if (!alive) return;
        setReport(EMPTY_REPORT);
        toast.error(err instanceof Error ? err.message : 'Failed to load report');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [period, nodeFilter, startTime, endTime]);

  const pieData = useMemo(
    () => report.nodes.filter((node) => node.usage > 0).map((node) => ({ name: node.name, value: node.usage })),
    [report.nodes],
  );

  const barData = useMemo(
    () => report.nodes.map((node) => ({ name: node.name, usage: node.usage })),
    [report.nodes],
  );

  const nodeLabel = nodeFilter === 'all'
    ? 'All Nodes'
    : nodes.find((node) => node.id === nodeFilter)?.name ?? nodeFilter;

  const handleDownload = () => {
    if (report.trend.length === 0) {
      toast.error('No data to export');
      return;
    }
    const rows = report.trend.map((point) => [
      point.time,
      nodeLabel,
      String(point.usage),
      PERIOD_LABEL[period],
    ]);
    downloadCsv('sfm-report.csv', ['Time', 'Node', 'Usage (L)', 'Period'], rows);
    toast.success('Report exported', { description: `${rows.length} rows downloaded.` });
  };

  const hasTrend = report.trend.length > 0;
  const emptyChart = loading ? 'Loading...' : 'No usage data in this period.';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#0d1c2d', letterSpacing: '-0.01em' }}>
            Usage Reports
          </h1>
          <p className="text-sm mt-1" style={{ color: '#45474c' }}>
            Water consumption by period and node.
          </p>
        </div>
        <Button
          onClick={handleDownload}
          disabled={loading || report.trend.length === 0}
          style={{ background: '#57dffe', color: '#091426', border: 'none' }}
          className="font-semibold gap-2 shrink-0"
        >
          <Download className="w-4 h-4" /> Download CSV
        </Button>
      </div>

      <div className="sfm-card p-4 flex flex-col lg:flex-row gap-3 flex-wrap">
        <Select value={period} onValueChange={(value: ReportPeriod) => setPeriod(value)}>
          <SelectTrigger className="w-full sm:w-[150px]" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">This Month</SelectItem>
          </SelectContent>
        </Select>

        <Select value={nodeFilter} onValueChange={setNodeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
            <SelectValue placeholder="Node" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Nodes</SelectItem>
            {nodes.map((node) => (
              <SelectItem key={node.id} value={node.id}>{node.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {period === 'today' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-9 w-full sm:w-[120px]"
              style={{ borderColor: '#e2e8f0' }}
            />
            <span className="text-sm" style={{ color: '#75777d' }}>to</span>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="h-9 w-full sm:w-[120px]"
              style={{ borderColor: '#e2e8f0' }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Period Usage',
            val: formatLiters(report.stats.totalUsage),
            unit: 'L',
          },
          {
            label: report.stats.averageUnit === 'hour' ? 'Average Hourly' : 'Average Daily',
            val: formatLiters(report.stats.average),
            unit: 'L',
          },
          {
            label: 'Highest Usage',
            val: report.stats.highest?.name || '—',
            sub: report.stats.highest ? `${formatLiters(report.stats.highest.usage)} L` : undefined,
          },
          {
            label: 'Lowest Usage',
            val: report.stats.lowest?.name || '—',
            sub: report.stats.lowest ? `${formatLiters(report.stats.lowest.usage)} L` : undefined,
          },
        ].map((card, i) => (
          <div key={i} className="sfm-card p-5">
            <div className="sfm-label-caps mb-2">{card.label}</div>
            <div className="sfm-data-value text-xl">
              {card.val} {card.unit && <span className="sfm-data-unit text-sm">{card.unit}</span>}
            </div>
            {card.sub && <div className="text-xs mt-1" style={{ color: '#75777d' }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="sfm-card p-5 lg:col-span-2">
          <h2 className="font-semibold text-sm mb-4" style={{ color: '#0d1c2d' }}>Consumption Trend</h2>
          <div className="h-[280px]">
            {hasTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.trend} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fill: '#75777d', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#75777d', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <RechartsTip
                    formatter={(value) => [`${value} L`, 'Usage']}
                    contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="usage" stroke="#57dffe" strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: '#57dffe', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: '#75777d' }}>
                {emptyChart}
              </div>
            )}
          </div>
        </div>

        <div className="sfm-card p-5">
          <h2 className="font-semibold text-sm mb-4" style={{ color: '#0d1c2d' }}>Usage Share</h2>
          {pieData.length > 0 ? (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTip
                      formatter={(value) => [`${formatLiters(Number(value))} L`, 'Usage']}
                      contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 max-h-[180px] space-y-2 overflow-y-auto pr-1">
                {pieData.map((d, i) => {
                  const total = pieData.reduce((sum, row) => sum + row.value, 0) || 1;
                  const pct = ((d.value / total) * 100).toFixed(0);
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium" style={{ color: '#0d1c2d' }} title={d.name}>
                        {d.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums" style={{ color: '#75777d' }}>
                        {formatLiters(d.value)} L · {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm" style={{ color: '#75777d' }}>
              {emptyChart}
            </div>
          )}
        </div>
      </div>

      <div className="sfm-card p-5">
        <h2 className="font-semibold text-sm mb-4" style={{ color: '#0d1c2d' }}>Node Consumption Comparison</h2>
        <div className="h-[260px]">
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fill: '#75777d', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#75777d', fontSize: 12 }} tickLine={false} axisLine={false} />
                <RechartsTip
                  formatter={(value) => [`${value} L`, 'Usage']}
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="usage" fill="#57dffe" radius={[6, 6, 0, 0]} barSize={48} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: '#75777d' }}>
              {emptyChart}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
