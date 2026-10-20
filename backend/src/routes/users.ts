import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.enum(['super_admin', 'operator']),
});

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(['super_admin', 'operator']).optional(),
  password: z.string().min(8).max(72).optional(),
});

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'operator';
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

async function superAdminCount() {
  return prisma.user.count({ where: { role: 'super_admin' } });
}

export async function userRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireRole('super_admin'));

  app.get('/', async () => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return { users: users.map(publicUser) };
  });

  app.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid user payload' });
    }

    const email = parsed.data.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return reply.code(409).send({ error: 'Email already in use' });
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        passwordHash: await bcrypt.hash(parsed.data.password, 10),
        role: parsed.data.role,
      },
    });

    await prisma.systemLog.create({
      data: {
        userId: request.user.sub,
        action: 'Create user',
        description: `${request.user.name} created ${user.name} (${user.role})`,
      },
    });

    return reply.code(201).send({ user: publicUser(user) });
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid user payload' });
    }

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return reply.code(404).send({ error: 'User not found' });

    if (parsed.data.role === 'operator' && current.role === 'super_admin') {
      const count = await superAdminCount();
      if (count <= 1) {
        return reply.code(400).send({ error: 'Cannot demote the last super admin' });
      }
    }

    if (parsed.data.email) {
      const email = parsed.data.email.toLowerCase();
      const clash = await prisma.user.findFirst({ where: { email, NOT: { id } } });
      if (clash) return reply.code(409).send({ error: 'Email already in use' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name?.trim(),
        email: parsed.data.email?.toLowerCase(),
        role: parsed.data.role,
        passwordHash: parsed.data.password
          ? await bcrypt.hash(parsed.data.password, 10)
          : undefined,
      },
    });

    if (parsed.data.password) {
      await prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    await prisma.systemLog.create({
      data: {
        userId: request.user.sub,
        action: parsed.data.password ? 'Reset user password' : 'Update user',
        description: `${request.user.name} updated ${user.name}`,
      },
    });

    return { user: publicUser(user) };
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (id === request.user.sub) {
      return reply.code(400).send({ error: 'You cannot delete your own account' });
    }

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) return reply.code(404).send({ error: 'User not found' });

    if (current.role === 'super_admin' && (await superAdminCount()) <= 1) {
      return reply.code(400).send({ error: 'Cannot delete the last super admin' });
    }

    await prisma.user.delete({ where: { id } });
    await prisma.systemLog.create({
      data: {
        userId: request.user.sub,
        action: 'Delete user',
        description: `${request.user.name} deleted ${current.name}`,
      },
    });

    return { ok: true };
  });
}
