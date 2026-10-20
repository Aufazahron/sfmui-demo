import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Lock,
  RefreshCw,
  Loader2,
  Droplets,
  Activity,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

import { toast } from 'sonner';

import type { SFMNode, NodeMode, NodeSchedule } from '@/types';
import StatusBadge from '@/components/common/StatusBadge';
import ValveBadge from '@/components/common/ValveBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fetchNodeTelemetry } from '@/services/nodesApi';
import { useLiveTelemetry } from '@/context/LiveTelemetryContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ChartRange = '1h' | '1d' | '1w' | '1m';

const RANGE_LABELS: { id: ChartRange; label: string }[] = [
  { id: '1h', label: '1 jam' },
  { id: '1d', label: '1 hari' },
  { id: '1w', label: '1 minggu' },
  { id: '1m', label: '1 bulan' },
];

function schedulesEqual(a: NodeSchedule, b: NodeSchedule) {
  return (
    a.active === b.active &&
    a.openTime === b.openTime &&
    a.closeTime === b.closeTime
  );
}

const EVERY_DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function SaveButton({
  hasChanges,
  label,
}: {
  hasChanges: boolean;
  label: string;
}) {
  return (
    <Button
      type="submit"
      disabled={!hasChanges}
      className={cn(
        'w-full font-semibold transition-all duration-200',
        hasChanges && 'hover:brightness-95 hover:shadow-md active:scale-[0.98]',
      )}
      style={
        hasChanges
          ? { background: '#57dffe', color: '#091426', border: 'none' }
          : { background: '#c5c6cd', color: '#75777d', border: 'none', cursor: 'not-allowed' }
      }
    >
      {label}
    </Button>
  );
}

function ConfirmSaveDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" style={{ borderColor: '#e2e8f0' }}>
        <DialogHeader>
          <DialogTitle style={{ color: '#0d1c2d' }}>{title}</DialogTitle>
          <DialogDescription style={{ color: '#45474c' }}>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="transition-all hover:bg-[#eef4ff]"
            style={{ borderColor: '#e2e8f0' }}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="transition-all hover:brightness-95 hover:shadow-md active:scale-[0.98]"
            style={{ background: '#57dffe', color: '#091426', border: 'none' }}
            onClick={onConfirm}
          >
            Yes, Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LimitForm({
  dailyLimit,
  onSave,
}: {
  dailyLimit: number;
  onSave: (limit: number) => void;
}) {
  const [value, setValue] = useState(String(dailyLimit));
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setValue(String(dailyLimit));
  }, [dailyLimit]);

  const parsed = Number(value);
  const hasChanges = value !== '' && !Number.isNaN(parsed) && parsed !== dailyLimit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;
    if (parsed <= 0) {
      toast.error('Limit must be greater than 0');
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSave = () => {
    onSave(parsed);
    setConfirmOpen(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="sfm-label-caps mb-1.5 block">Daily Limit (Liters)</label>
          <Input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="h-9 transition-colors focus-visible:ring-[#57dffe]"
            style={{ borderColor: hasChanges ? '#57dffe' : '#e2e8f0' }}
          />
        </div>
        <SaveButton hasChanges={hasChanges} label="Save Limit" />
      </form>

      <ConfirmSaveDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save Daily Limit?"
        description={
          <>
            Daily limit will be changed from <b>{dailyLimit.toLocaleString()} L</b> to{' '}
            <b>{parsed.toLocaleString()} L</b>.
          </>
        }
        onConfirm={confirmSave}
      />
    </>
  );
}

function ScheduleForm({
  schedule,
  onSave,
  disabled = false,
}: {
  schedule: NodeSchedule;
  onSave: (schedule: NodeSchedule) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<NodeSchedule>(schedule);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setDraft(schedule);
  }, [schedule]);

  const hasChanges = !schedulesEqual(draft, schedule);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges || disabled) return;
    if (draft.openTime && draft.closeTime && draft.openTime >= draft.closeTime) {
      toast.error('Open time must be earlier than close time');
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSave = () => {
    onSave({ ...draft, days: EVERY_DAY });
    setConfirmOpen(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" style={{ opacity: disabled ? 0.45 : 1 }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 shrink-0" style={{ color: disabled ? '#c5c6cd' : '#00687a' }} />
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: disabled ? '#c5c6cd' : '#0d1c2d' }}>
                Operating Schedule
              </p>
              <p className="text-[11px]" style={{ color: disabled ? '#c5c6cd' : '#75777d' }}>
                Every day
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.active}
            aria-label="Enable schedule"
            disabled={disabled}
            onClick={() => setDraft((prev) => ({ ...prev, active: !prev.active }))}
            className="inline-flex items-center gap-2 shrink-0 disabled:cursor-not-allowed"
          >
            <span
              className="text-xs font-semibold"
              style={{ color: draft.active && !disabled ? '#1a7a3c' : '#75777d' }}
            >
              {draft.active ? 'On' : 'Off'}
            </span>
            <span
              className="relative h-6 w-11 rounded-full transition-colors duration-200"
              style={{
                background: draft.active && !disabled ? '#57dffe' : '#c5c6cd',
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: draft.active ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </span>
          </button>
        </div>

        {disabled && (
          <p className="text-xs" style={{ color: '#c5c6cd' }}>
            Schedule is only available in automatic mode.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="sfm-label-caps mb-1.5 block" style={{ color: disabled ? '#c5c6cd' : undefined }}>
              Open Time
            </label>
            <Input
              type="time"
              disabled={disabled}
              value={draft.openTime}
              onChange={e => setDraft(prev => ({ ...prev, openTime: e.target.value }))}
              className="h-9 transition-colors focus-visible:ring-[#57dffe] disabled:cursor-not-allowed"
              style={{ borderColor: draft.openTime !== schedule.openTime && !disabled ? '#57dffe' : '#e2e8f0', background: disabled ? '#f8f9ff' : undefined }}
            />
          </div>
          <div>
            <label className="sfm-label-caps mb-1.5 block" style={{ color: disabled ? '#c5c6cd' : undefined }}>
              Close Time
            </label>
            <Input
              type="time"
              disabled={disabled}
              value={draft.closeTime}
              onChange={e => setDraft(prev => ({ ...prev, closeTime: e.target.value }))}
              className="h-9 transition-colors focus-visible:ring-[#57dffe] disabled:cursor-not-allowed"
              style={{ borderColor: draft.closeTime !== schedule.closeTime && !disabled ? '#57dffe' : '#e2e8f0', background: disabled ? '#f8f9ff' : undefined }}
            />
          </div>
        </div>

        <SaveButton hasChanges={hasChanges && !disabled} label="Save Schedule" />
      </form>

      <ConfirmSaveDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save Operating Schedule?"
        description={
          <>
            Schedule will run <b>every day</b>,{' '}
            <b>{draft.active ? 'on' : 'off'}</b>, open <b>{draft.openTime}</b>, close{' '}
            <b>{draft.closeTime}</b>.
          </>
        }
        onConfirm={confirmSave}
      />
    </>
  );
}

function UsageGauge({ pct }: { pct: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 100 ? '#ba1a1a' : pct >= 80 ? '#e67e22' : '#57dffe';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e5efff" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="sfm-data-value text-2xl">{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function ModeBadge({ mode, onClick }: { mode: NodeMode; onClick: () => void }) {
  const isAuto = mode === 'automatic';
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-105 hover:shadow-sm active:scale-95"
      style={{
        background: isAuto ? 'rgba(87,223,254,0.15)' : 'rgba(117,119,125,0.12)',
        color: isAuto ? '#00687a' : '#45474c',
        border: `1px solid ${isAuto ? 'rgba(87,223,254,0.4)' : '#e2e8f0'}`,
      }}
    >
      <RefreshCw className="w-3 h-3" />
      {isAuto ? 'Automatic Mode' : 'Manual Mode'}
    </button>
  );
}

interface NodeDetailViewProps {
  node: SFMNode;
  onBack: () => void;
  onModeChange: (mode: NodeMode) => void;
  onValveChange: (state: 'open' | 'closed', reason: string) => void | Promise<void>;
  onLimitSave: (limit: number) => void;
  onScheduleSave: (schedule: NodeSchedule) => void;
}

export default function NodeDetailView({
  node,
  onBack,
  onModeChange,
  onValveChange,
  onLimitSave,
  onScheduleSave,
}: NodeDetailViewProps) {
  const { sparklines, telemetryTicks } = useLiveTelemetry();
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<NodeMode | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>('1h');
  const [chartPoints, setChartPoints] = useState<{ t: string; flow: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [pendingValve, setPendingValve] = useState<'open' | 'closed' | null>(null);
  const [valveDialog, setValveDialog] = useState<'open' | 'closed' | null>(null);
  const [valveReason, setValveReason] = useState('');

  const isAutomaticMode = node.mode === 'automatic';
  const valveBusy = pendingValve !== null;
  const usagePct = node.dailyLimit > 0 ? Math.min((node.todayUsage / node.dailyLimit) * 100, 100) : 0;
  const sparkline = sparklines[node.id] ?? [];
  const flowThreshold = Math.max(
    ...chartPoints.map((p) => p.flow),
    node.flowrate * 1.2,
    3,
  );

  const telemetryTick = telemetryTicks[node.id] ?? 0;
  const prevTick = useRef(telemetryTick);

  useEffect(() => {
    let alive = true;
    prevTick.current = telemetryTick;
    setChartLoading(true);
    void fetchNodeTelemetry(node.id, chartRange)
      .then((data) => {
        if (alive) setChartPoints(data.points);
      })
      .catch(() => {
        if (alive) setChartPoints([]);
      })
      .finally(() => {
        if (alive) setChartLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [node.id, chartRange]);

  useEffect(() => {
    if (telemetryTick === prevTick.current) return;
    prevTick.current = telemetryTick;
    if (telemetryTick === 0) return;
    let alive = true;
    void fetchNodeTelemetry(node.id, chartRange)
      .then((data) => {
        if (alive) setChartPoints(data.points);
      })
      .catch(() => {
        /* keep current points */
      });
    return () => {
      alive = false;
    };
  }, [telemetryTick, node.id, chartRange]);

  useEffect(() => {
    if (pendingValve && node.valveState === pendingValve) {
      setPendingValve(null);
    }
  }, [node.valveState, pendingValve]);

  useEffect(() => {
    if (!pendingValve) return;
    const timer = setTimeout(() => {
      setPendingValve(null);
      toast.error('Valve command timed out', {
        description: 'No confirmation from the device. Check connection and try again.',
      });
    }, 20_000);
    return () => clearTimeout(timer);
  }, [pendingValve]);

  const commandValve = (state: 'open' | 'closed') => {
    if (isAutomaticMode || valveBusy || node.valveState === state) return;
    setValveReason('');
    setValveDialog(state);
  };

  const confirmValveChange = async () => {
    const reason = valveReason.trim();
    if (!valveDialog || !reason) return;
    const state = valveDialog;
    setValveDialog(null);
    setValveReason('');
    setPendingValve(state);
    try {
      await onValveChange(state, reason);
    } catch {
      setPendingValve(null);
    }
  };

  const openDisabled = isAutomaticMode || valveBusy || node.valveState === 'open';
  const closeDisabled = isAutomaticMode || valveBusy || node.valveState === 'closed';

  const openModeDialog = () => {
    const next = node.mode === 'manual' ? 'automatic' : 'manual';
    setPendingMode(next);
    setModeDialogOpen(true);
  };

  const confirmModeChange = () => {
    if (pendingMode) onModeChange(pendingMode);
    setModeDialogOpen(false);
    setPendingMode(null);
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-4 transition-all duration-200 hover:opacity-70 hover:translate-x-[-2px]"
          style={{ color: '#00687a' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Topology SFM
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold" style={{ color: '#0d1c2d', letterSpacing: '-0.01em' }}>
              {node.name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#75777d' }}>
              {node.id} · {node.location}
            </p>
          </div>
          <StatusBadge status={node.status} since={node.statusChangedAt} />
        </div>
      </div>

      {/* Mode change confirmation */}
      <Dialog open={modeDialogOpen} onOpenChange={setModeDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ borderColor: '#e2e8f0' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#0d1c2d' }}>
              Change Operating Mode
            </DialogTitle>
            <DialogDescription style={{ color: '#45474c' }}>
              {pendingMode === 'automatic' ? (
                <>
                  Node <b>{node.name}</b> will be switched to <b>Automatic</b> mode.
                  The valve will be managed by the system based on daily limit and schedule — manual control will be disabled.
                </>
              ) : (
                <>
                  Node <b>{node.name}</b> will be switched to <b>Manual</b> mode.
                  The operator can open and close the valve directly.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="transition-all hover:bg-[#eef4ff]"
              style={{ borderColor: '#e2e8f0' }}
              onClick={() => { setModeDialogOpen(false); setPendingMode(null); }}
            >
              Cancel
            </Button>
            <Button
              className="transition-all hover:brightness-95 hover:shadow-md active:scale-[0.98]"
              style={{ background: '#57dffe', color: '#091426', border: 'none' }}
              onClick={confirmModeChange}
            >
              Yes, Change Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Valve description confirmation */}
      <Dialog
        open={valveDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setValveDialog(null);
            setValveReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md" style={{ borderColor: '#e2e8f0' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#0d1c2d' }}>
              {valveDialog === 'open' ? 'Open valve' : 'Close valve'}
            </DialogTitle>
            <DialogDescription style={{ color: '#45474c' }}>
              Describe why you are {valveDialog === 'open' ? 'opening' : 'closing'} the valve on{' '}
              <b>{node.name}</b>. This is recorded in System Log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: '#0d1c2d' }} htmlFor="valve-reason">
              Description
            </label>
            <textarea
              id="valve-reason"
              value={valveReason}
              onChange={(event) => setValveReason(event.target.value)}
              rows={4}
              placeholder="Required"
              className="flex min-h-[96px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              style={{ borderColor: '#e2e8f0', color: '#0d1c2d' }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="transition-all hover:bg-[#eef4ff]"
              style={{ borderColor: '#e2e8f0' }}
              onClick={() => {
                setValveDialog(null);
                setValveReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!valveReason.trim()}
              className="transition-all hover:brightness-95 hover:shadow-md active:scale-[0.98] disabled:pointer-events-none"
              style={
                valveReason.trim()
                  ? { background: '#57dffe', color: '#091426', border: 'none' }
                  : { background: '#c5c6cd', color: '#75777d', border: 'none' }
              }
              onClick={() => void confirmValveChange()}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left column — monitoring + charts + logs */}
        <div className="xl:col-span-2 space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sfm-card p-6">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4" style={{ color: '#00687a' }} />
                <span className="sfm-label-caps">Real-time Flow</span>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="sfm-data-value text-3xl">{node.flowrate}</div>
                  <div className="text-sm mt-0.5" style={{ color: '#75777d' }}>L/min</div>
                  <div className="text-xs mt-2" style={{ color: '#45474c' }}>
                    Odometer {node.odometer.toLocaleString()} L
                  </div>
                </div>
                <div className="w-28 h-14 shrink-0">
                  {sparkline.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sparkline} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Bar dataKey="v" fill="#57dffe" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-end justify-center text-[10px]" style={{ color: '#75777d' }}>
                      Waiting live…
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sfm-card p-6">
              <div className="flex items-center gap-2 mb-3">
                <Droplets className="w-4 h-4" style={{ color: '#00687a' }} />
                <span className="sfm-label-caps">Daily Consumption</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <UsageGauge pct={usagePct} />
                <div className="text-right space-y-2">
                  <div>
                    <div className="sfm-label-caps mb-0.5">Used</div>
                    <div className="font-semibold" style={{ color: '#0d1c2d' }}>
                      {node.todayUsage.toLocaleString()} L
                    </div>
                  </div>
                  <div>
                    <div className="sfm-label-caps mb-0.5">Limit</div>
                    <div className="font-semibold" style={{ color: '#0d1c2d' }}>
                      {node.dailyLimit.toLocaleString()} L
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Historical flow chart */}
          <div className="sfm-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="font-semibold text-sm" style={{ color: '#0d1c2d' }}>Flow Rate</h3>
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
            </div>
            <div className="h-[220px]">
              {chartLoading ? (
                <div className="h-full flex items-center justify-center text-sm" style={{ color: '#75777d' }}>
                  Loading…
                </div>
              ) : chartPoints.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm" style={{ color: '#75777d' }}>
                  Belum ada data menit untuk rentang ini
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartRange === '1h' ? (
                    <BarChart data={chartPoints} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="t" tick={{ fill: '#75777d', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#75777d', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <RechartsTip
                        contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                        formatter={(value) => [`${value ?? 0} L/min`, 'Flow']}
                      />
                      <Bar dataKey="flow" fill="#4c8dff" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={chartPoints} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="t" tick={{ fill: '#75777d', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#75777d', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <RechartsTip
                        contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
                        formatter={(value) => [`${value ?? 0} L/min`, 'Flow']}
                      />
                      <ReferenceLine
                        y={flowThreshold}
                        stroke="#ba1a1a"
                        strokeDasharray="6 4"
                        label={{ value: 'Threshold', fill: '#ba1a1a', fontSize: 10, position: 'insideTopRight' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="flow"
                        stroke="#4c8dff"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#4c8dff' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>

        {/* Right column — control + limits/schedules */}
        <div className="space-y-5">
          {/* Control Panel */}
          <div className="sfm-card p-5">
            <h3 className="font-semibold text-sm mb-4" style={{ color: '#0d1c2d' }}>Control Panel</h3>

            <div
              className="flex items-center justify-between p-4 rounded-xl mb-3"
              style={{ background: '#f8f9ff', border: '1px solid #e2e8f0' }}
            >
              <div>
                <div className="sfm-label-caps mb-1">Operating Mode</div>
                <div className="text-sm font-semibold" style={{ color: '#0d1c2d' }}>
                  {node.mode === 'automatic' ? 'Automatic' : 'Manual'}
                </div>
              </div>
              <ModeBadge mode={node.mode} onClick={openModeDialog} />
            </div>

            <div
              className="flex items-center justify-between p-4 rounded-xl mb-4"
              style={{
                background: valveBusy ? 'rgba(230,126,34,0.08)' : '#f8f9ff',
                border: valveBusy ? '1px solid rgba(230,126,34,0.3)' : '1px solid #e2e8f0',
              }}
            >
              <div>
                <div className="sfm-label-caps mb-1">Current State</div>
                <div className="text-sm font-semibold flex items-center gap-2" style={{ color: valveBusy ? '#b45309' : '#0d1c2d' }}>
                  {valveBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pendingValve === 'open'
                    ? 'Opening valve…'
                    : pendingValve === 'closed'
                      ? 'Closing valve…'
                      : `Valve ${node.valveState === 'open' ? 'Open' : 'Closed'}`}
                </div>
              </div>
              {valveBusy ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(230,126,34,0.15)', color: '#b45309' }}
                >
                  Proses
                </span>
              ) : (
                <ValveBadge state={node.valveState} />
              )}
            </div>

            {isAutomaticMode && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl mb-4 text-xs"
                style={{ background: 'rgba(230,126,34,0.08)', border: '1px solid rgba(230,126,34,0.25)', color: '#b45309' }}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Automatic mode is active — valve control is locked. Switch to manual mode in the control panel above.</span>
              </div>
            )}

            <div className="space-y-2">
              <Button
                className="w-full h-11 font-semibold justify-center gap-2 transition-all duration-200 disabled:pointer-events-none"
                disabled={openDisabled}
                style={
                  openDisabled
                    ? { background: '#e8eaef', color: '#9aa0a6', border: 'none', opacity: 1 }
                    : { background: '#1a7a3c', color: '#ffffff', border: 'none' }
                }
                onClick={() => void commandValve('open')}
              >
                {isAutomaticMode && <Lock className="w-3.5 h-3.5" />}
                {pendingValve === 'open' && <Loader2 className="w-4 h-4 animate-spin" />}
                {pendingValve === 'open' ? 'Opening…' : 'Open'}
              </Button>
              <Button
                className="w-full h-11 font-semibold justify-center gap-2 transition-all duration-200 disabled:pointer-events-none"
                disabled={closeDisabled}
                style={
                  closeDisabled
                    ? { background: '#e8eaef', color: '#9aa0a6', border: 'none', opacity: 1 }
                    : { background: '#ba1a1a', color: '#ffffff', border: 'none' }
                }
                onClick={() => void commandValve('closed')}
              >
                {isAutomaticMode && <Lock className="w-3.5 h-3.5" />}
                {pendingValve === 'closed' && <Loader2 className="w-4 h-4 animate-spin" />}
                {pendingValve === 'closed' ? 'Closing…' : 'Close'}
              </Button>
            </div>
          </div>

          {/* Limits & Schedules */}
          <div className="sfm-card p-5">
            <h3 className="font-semibold text-sm mb-1" style={{ color: '#0d1c2d' }}>Limits & Schedules</h3>
            <p className="text-xs mb-4" style={{ color: '#75777d' }}>
              Limit and schedule apply together — whichever condition is met first takes effect.
            </p>

            <Tabs defaultValue="limit">
              <TabsList className="w-full mb-4 h-9" style={{ background: '#eef4ff' }}>
                <TabsTrigger value="limit" className="flex-1 text-xs font-semibold transition-all hover:bg-white/60">Daily Limit</TabsTrigger>
                <TabsTrigger value="schedule" className="flex-1 text-xs font-semibold transition-all hover:bg-white/60">Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="limit" className="mt-0 space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span style={{ color: '#45474c' }}>Today&apos;s Usage</span>
                    <span className="font-semibold" style={{ color: '#0d1c2d' }}>
                      {node.todayUsage.toLocaleString()} / {node.dailyLimit.toLocaleString()} L
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#e5efff' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${usagePct}%`,
                        background: usagePct >= 100 ? '#ba1a1a' : usagePct >= 80 ? '#e67e22' : '#57dffe',
                      }}
                    />
                  </div>
                </div>

                <LimitForm dailyLimit={node.dailyLimit} onSave={onLimitSave} />
              </TabsContent>

              <TabsContent value="schedule" className="mt-0">
                <ScheduleForm
                  schedule={node.schedule}
                  onSave={onScheduleSave}
                  disabled={!isAutomaticMode}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
