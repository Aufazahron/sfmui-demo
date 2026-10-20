import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { toast } from 'sonner';

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { downloadCsv } from '@/lib/downloadCsv';
import { formatJakartaDateTime } from '@/lib/datetime';
import { useAuth } from '@/context/AuthContext';
import { fetchLogs, type ApiLog, type LogType } from '@/services/logsApi';

const PAGE_SIZE = 20;

export default function Logs() {
  const { isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | LogType>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const effectiveType: 'All' | LogType = isSuperAdmin ? typeFilter : 'Device';

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLogs({
        page,
        pageSize: PAGE_SIZE,
        type: effectiveType,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        q: search || undefined,
      });
      setLogs(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load logs');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, effectiveType, dateFrom, dateTo, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<ApiLog>[] = useMemo(() => [
    {
      accessorKey: 'createdAt',
      header: 'Time',
      cell: ({ row }) => {
        const { date, time } = formatJakartaDateTime(row.getValue('createdAt') as string);
        return (
          <div>
            <div className="text-sm font-medium" style={{ color: '#0d1c2d' }}>{date}</div>
            <div className="text-xs" style={{ color: '#75777d' }}>{time}</div>
          </div>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Log Type',
      cell: ({ row }) => {
        const type = row.getValue('type') as LogType;
        const style = type === 'System'
          ? { bg: '#eef2ff', text: '#4338ca' }
          : { bg: '#faf5ff', text: '#7e22ce' };
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: style.bg, color: style.text }}>
            {type}
          </span>
        );
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <span className="text-sm font-medium" style={{ color: '#0d1c2d' }}>{row.getValue('source')}</span>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Activity',
      cell: ({ row }) => (
        <span className="text-sm font-medium" style={{ color: '#45474c' }}>{row.getValue('action')}</span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-sm" style={{ color: '#75777d' }}>{row.getValue('description')}</span>
      ),
    },
  ], []);

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });

  const handleDownload = async () => {
    setExporting(true);
    try {
      const data = await fetchLogs({
        page: 1,
        pageSize: 500,
        type: effectiveType,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        q: search || undefined,
      });
      const rows = (Array.isArray(data.items) ? data.items : []).map(l => {
        const { csv } = formatJakartaDateTime(l.createdAt);
        return [csv, l.type, l.source, l.action, l.description];
      });
      downloadCsv('sfm-logs.csv', ['Time', 'Log Type', 'Source', 'Activity', 'Description'], rows);
      toast.success('Logs exported', {
        description: data.total > data.items.length
          ? `${data.items.length} of ${data.total} entries downloaded.`
          : `${data.items.length} entries downloaded.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export logs');
    } finally {
      setExporting(false);
    }
  };

  const emptyMessage = loading
    ? 'Loading...'
    : total === 0
      ? 'Belum ada log'
      : 'No results.';

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#0d1c2d', letterSpacing: '-0.01em' }}>
            {isSuperAdmin ? 'System & Device Logs' : 'Device Logs'}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#45474c' }}>
            {isSuperAdmin
              ? 'Detailed history of system events and device activities.'
              : 'History of device activities.'}
          </p>
        </div>
        <Button
          onClick={() => void handleDownload()}
          disabled={loading || exporting || total === 0}
          className="font-semibold gap-2 shrink-0"
          style={{ background: '#57dffe', color: '#091426', border: 'none' }}
        >
          <Download className="w-4 h-4" /> Download CSV
        </Button>
      </div>

      <div className="sfm-card overflow-hidden">
        <div className="p-4 border-b flex flex-col gap-3" style={{ borderColor: '#e2e8f0' }}>
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: '#75777d' }} />
            <Input
              placeholder="Search by activity, source, or description..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-9 h-9 text-sm"
              style={{ borderColor: '#e2e8f0', background: '#f8f9ff' }}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {isSuperAdmin && (
              <Select
                value={typeFilter}
                onValueChange={(value: 'All' | LogType) => {
                  setTypeFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 text-sm w-full sm:w-[140px]" style={{ borderColor: '#e2e8f0' }}>
                  <SelectValue placeholder="Log Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  <SelectItem value="System">System</SelectItem>
                  <SelectItem value="Device">Device</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 text-sm w-full sm:w-[150px]"
              style={{ borderColor: '#e2e8f0' }}
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-9 text-sm w-full sm:w-[150px]"
              style={{ borderColor: '#e2e8f0' }}
              placeholder="To"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id} style={{ borderColor: '#e2e8f0', background: '#f8f9ff' }}>
                  {hg.headers.map(h => (
                    <TableHead key={h.id} className="sfm-label-caps py-3 px-4">
                      {!h.isPlaceholder && flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {!loading && table.getRowModel().rows.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} style={{ borderColor: '#e2e8f0' }} className="hover:bg-[#f8f9ff]">
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="py-3 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-sm" style={{ color: '#75777d' }}>
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: '#e2e8f0' }}>
          <span className="text-xs" style={{ color: '#75777d' }}>
            Showing {rangeStart}–{rangeEnd} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              style={{ borderColor: '#e2e8f0' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs min-w-[3rem] text-center" style={{ color: '#75777d' }}>
              {page}/{pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount || loading}
              style={{ borderColor: '#e2e8f0' }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
