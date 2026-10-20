import { Handle, Position } from '@xyflow/react';
import { Fan, Activity, Droplet } from 'lucide-react';
import type { SFMNode } from '@/types';
import { cn } from '@/lib/utils';
import ValveBadge from '../common/ValveBadge';
import ModeBadge from '../common/ModeBadge';
import { StatusSinceHover } from '../common/StatusBadge';

export default function TopologyNode({ data }: { data: { node: SFMNode, onClick: (node: SFMNode) => void } }) {
  const { node, onClick } = data;

  return (
    <div 
      className={cn(
        "border-2 rounded-lg w-64 cursor-pointer transition-all duration-200 group relative",
        node.status === 'offline' ? "bg-slate-100 border-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.4)] grayscale-[0.2]" : "bg-card",
        node.status !== 'offline' && node.status === 'warning' ? "border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : "",
        node.status !== 'offline' && node.status !== 'warning' && node.valveState === 'open' ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "",
        node.status !== 'offline' && node.status !== 'warning' && node.valveState === 'closed' ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]" : "",
        "hover:scale-[1.02] hover:shadow-md"
      )}
      onClick={() => onClick(node)}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-muted-foreground/50" />
      
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-md",
              node.status === 'online' ? "bg-[#57dffe]/20 text-[#00687a]" :
              node.status === 'offline' ? "bg-slate-500/10 text-slate-500" :
              "bg-amber-500/10 text-amber-500"
            )}>
              <Fan 
                className={cn("w-4 h-4", node.flowrate > 0 && "animate-spin")} 
                style={
                  node.flowrate > 0 
                    ? { animationDuration: `${Math.max(0.4, 100 / (node.flowrate + 15))}s` } 
                    : {}
                }
              />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors">{node.name}</div>
              <div className="text-[10px] text-muted-foreground">{node.location}</div>
            </div>
          </div>
          <StatusSinceHover status={node.status} since={node.statusChangedAt}>
            <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              {node.status === 'online' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00687a] opacity-75"></span>
              )}
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                node.status === 'online' ? "bg-[#00687a]" :
                node.status === 'offline' ? "bg-[#75777d]" : "bg-[#e67e22]"
              )}></span>
            </span>
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              node.status === 'online' ? "text-[#00687a]" :
              node.status === 'offline' ? "text-[#75777d]" : "text-[#e67e22]"
            )}>
              {node.status}
            </span>
            </div>
          </StatusSinceHover>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Activity className="w-3 h-3" /> Flowrate
            </span>
            <span className="text-xs font-medium">{node.flowrate} L/m</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Droplet className="w-3 h-3" /> Today
            </span>
            <span className="text-xs font-medium">{node.todayUsage} L</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
          <ModeBadge mode={node.mode} />
          <ValveBadge state={node.valveState} className="text-[10px] py-0 px-1.5 h-4" />
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-muted-foreground/50" />
    </div>
  );
}
