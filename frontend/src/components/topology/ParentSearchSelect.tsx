import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { SFMNode } from '@/types';

interface ParentSearchSelectProps {
  value: string;
  nodes: SFMNode[];
  excludeId?: string;
  onChange: (value: string) => void;
}

export default function ParentSearchSelect({
  value,
  nodes,
  excludeId,
  onChange,
}: ParentSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () => [
      { id: 'none', label: 'None (root)' },
      ...nodes
        .filter((n) => n.id !== excludeId)
        .map((n) => ({
          id: n.id,
          label: n.deviceId ? `${n.name} (${n.deviceId})` : n.name,
        })),
    ],
    [nodes, excludeId],
  );

  const selected = options.find((o) => o.id === value) ?? options[0];

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative" data-parent-search>
      <button
        type="button"
        className="flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 text-sm"
        style={{ borderColor: '#e2e8f0', color: '#0d1c2d' }}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate text-left">{selected.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] overflow-hidden rounded-md border shadow-lg"
          style={{ background: '#ffffff', borderColor: '#e2e8f0' }}
        >
          <div className="flex items-center gap-2 border-b px-2" style={{ borderColor: '#e2e8f0' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: '#9aa0a6' }} />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari parent..."
              className="h-9 border-0 shadow-none focus-visible:ring-0 placeholder:text-[#9aa0a6]"
            />
          </div>
          <ul className="max-h-44 overflow-y-auto py-1" style={{ background: '#ffffff' }}>
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm" style={{ color: '#75777d' }}>
                Tidak ada hasil
              </li>
            )}
            {filtered.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#eef4ff]"
                  style={{
                    background: option.id === value ? '#eef4ff' : '#ffffff',
                    color: '#0d1c2d',
                  }}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {option.id === value && <Check className="h-4 w-4 shrink-0" style={{ color: '#00687a' }} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
