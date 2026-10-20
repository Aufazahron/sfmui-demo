import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

type LogTypeFilter = 'All' | 'System' | 'Device';

function jakartaDayStart(date: string) {
  return new Date(`${date}T00:00:00+07:00`);
}

function jakartaDayEnd(date: string) {
  return new Date(`${date}T23:59:59.999+07:00`);
}

function createdAtFilter(from?: string, to?: string) {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = jakartaDayStart(from);
  if (to) range.lte = jakartaDayEnd(to);
  return Object.keys(range).length ? range : undefined;
}

export async function logRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const query = request.query as {
      page?: string;
      pageSize?: string;
      type?: string;
      from?: string;
      to?: string;
      q?: string;
    };

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 500);
    const isAdmin = request.user.role === 'super_admin';
    const type: LogTypeFilter = isAdmin
      ? query.type === 'System' || query.type === 'Device'
        ? query.type
        : 'All'
      : 'Device';
    const q = query.q?.trim() || '';
    const createdAt = createdAtFilter(query.from, query.to);
    const skip = (page - 1) * pageSize;

    const systemWhere = {
      ...(createdAt ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
              { user: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const deviceWhere = {
      ...(createdAt ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
              { node: { name: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const mapSystem = (log: {
      id: string;
      action: string;
      description: string;
      createdAt: Date;
      user: { name: string } | null;
    }) => ({
      id: log.id,
      type: 'System' as const,
      source: log.user?.name ?? 'Server',
      action: log.action,
      description: log.description,
      createdAt: log.createdAt.toISOString(),
    });

    const mapDevice = (log: {
      id: string;
      action: string;
      description: string;
      createdAt: Date;
      node: { name: string };
    }) => ({
      id: log.id,
      type: 'Device' as const,
      source: log.node.name,
      action: log.action,
      description: log.description,
      createdAt: log.createdAt.toISOString(),
    });

    if (type === 'System') {
      const [rows, total] = await Promise.all([
        prisma.systemLog.findMany({
          where: systemWhere,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: { user: { select: { name: true } } },
        }),
        prisma.systemLog.count({ where: systemWhere }),
      ]);
      return { items: rows.map(mapSystem), total, page, pageSize };
    }

    if (type === 'Device') {
      const [rows, total] = await Promise.all([
        prisma.deviceLog.findMany({
          where: deviceWhere,
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
          include: { node: { select: { name: true } } },
        }),
        prisma.deviceLog.count({ where: deviceWhere }),
      ]);
      return { items: rows.map(mapDevice), total, page, pageSize };
    }

    const take = page * pageSize;
    const [system, device, systemCount, deviceCount] = await Promise.all([
      prisma.systemLog.findMany({
        where: systemWhere,
        orderBy: { createdAt: 'desc' },
        take,
        include: { user: { select: { name: true } } },
      }),
      prisma.deviceLog.findMany({
        where: deviceWhere,
        orderBy: { createdAt: 'desc' },
        take,
        include: { node: { select: { name: true } } },
      }),
      prisma.systemLog.count({ where: systemWhere }),
      prisma.deviceLog.count({ where: deviceWhere }),
    ]);

    const items = [...system.map(mapSystem), ...device.map(mapDevice)]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(skip, skip + pageSize);

    return { items, total: systemCount + deviceCount, page, pageSize };
  });
}
