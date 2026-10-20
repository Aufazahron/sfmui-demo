import type { ValveState } from '@/types';
import { cn } from '@/lib/utils';

interface ValveBadgeProps {
  state: ValveState;
  className?: string;
}

export default function ValveBadge({ state, className }: ValveBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
        state === 'open' && 'chip-open',
        state === 'closed' && 'chip-closed',
        className
      )}
    >
      {state.charAt(0).toUpperCase() + state.slice(1)}
    </span>
  );
}
