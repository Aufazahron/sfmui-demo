import type { NodeMode } from '@/types';
import { cn } from '@/lib/utils';

interface ModeBadgeProps {
  mode: NodeMode;
  className?: string;
}

export default function ModeBadge({ mode, className }: ModeBadgeProps) {
  const isAuto = mode === 'automatic';
  return (
    <span
      className={cn('inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full', className)}
      style={{
        background: isAuto ? 'rgba(87,223,254,0.15)' : 'rgba(117,119,125,0.1)',
        color: isAuto ? '#00687a' : '#45474c',
        border: `1px solid ${isAuto ? 'rgba(87,223,254,0.35)' : '#e2e8f0'}`,
      }}
    >
      {isAuto ? 'Automatic' : 'Manual'}
    </span>
  );
}
