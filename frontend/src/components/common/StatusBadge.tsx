import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { NodeStatus } from '@/types';
import { formatStatusSince } from '@/lib/datetime';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: NodeStatus;
  since?: string;
  className?: string;
}

export function StatusSinceHover({
  status,
  since,
  children,
}: {
  status: NodeStatus;
  since?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  if (!since) return children;

  const { sinceLine, durationLine } = formatStatusSince(status, since, now);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const width = 220;
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
        const top = rect.bottom + 8;
        setPos({ top, left });
        setNow(Date.now());
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[80] max-w-[220px] rounded-md border bg-white px-2.5 py-2 text-left shadow-lg"
            style={{ top: pos.top, left: pos.left, borderColor: '#e2e8f0' }}
          >
            <p className="text-xs font-semibold" style={{ color: '#0d1c2d' }}>
              {sinceLine}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: '#75777d' }}>
              {durationLine}
            </p>
          </div>,
          document.body,
        )}
    </span>
  );
}

export default function StatusBadge({ status, since, className }: StatusBadgeProps) {
  return (
    <StatusSinceHover status={status} since={since}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
          status === 'online' && 'chip-online',
          status === 'offline' && 'chip-offline',
          status === 'warning' && 'chip-warning',
          className,
        )}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background:
              status === 'online' ? '#00687a' :
              status === 'offline' ? '#75777d' : '#e67e22',
          }}
        />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </StatusSinceHover>
  );
}
