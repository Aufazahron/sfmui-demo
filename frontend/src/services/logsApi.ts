import { apiFetch } from './api';

export type LogType = 'System' | 'Device';

export interface ApiLog {
  id: string;
  type: LogType;
  source: string;
  action: string;
  description: string;
  createdAt: string;
}

export interface FetchLogsParams {
  page?: number;
  pageSize?: number;
  type?: 'All' | LogType;
  from?: string;
  to?: string;
  q?: string;
}

export interface LogsPage {
  items: ApiLog[];
  total: number;
  page: number;
  pageSize: number;
}

function normalizeLogsResponse(raw: unknown, page: number, pageSize: number): LogsPage {
  if (!raw || typeof raw !== 'object') {
    return { items: [], total: 0, page, pageSize };
  }

  const data = raw as {
    items?: ApiLog[];
    total?: number;
    page?: number;
    pageSize?: number;
    system?: ApiLog[];
    device?: ApiLog[];
  };

  if (Array.isArray(data.items)) {
    return {
      items: data.items,
      total: Number(data.total) || data.items.length,
      page: Number(data.page) || page,
      pageSize: Number(data.pageSize) || pageSize,
    };
  }

  const system = Array.isArray(data.system) ? data.system : [];
  const device = Array.isArray(data.device) ? data.device : [];
  const merged = [...system, ...device].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const skip = (page - 1) * pageSize;

  return {
    items: merged.slice(skip, skip + pageSize),
    total: merged.length,
    page,
    pageSize,
  };
}

export async function fetchLogs(params: FetchLogsParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const query = new URLSearchParams();
  query.set('page', String(page));
  query.set('pageSize', String(pageSize));
  if (params.type && params.type !== 'All') query.set('type', params.type);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.q) query.set('q', params.q);
  const raw = await apiFetch(`/api/logs?${query.toString()}`);
  return normalizeLogsResponse(raw, page, pageSize);
}
