import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createRefreshToken, hashToken, signAccessToken } from '../lib/jwt.js';
import { authenticate } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

function publicUser(user: { id: string; email: string; name: string; role: 'super_admin' | 'operator' }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid email or password' });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const refresh = createRefreshToken();
    await prisma.refreshToken.create({
      data: { tokenHash: refresh.tokenHash, userId: user.id, expiresAt: refresh.expiresAt },
    });
    await prisma.systemLog.create({
      data: {
        userId: user.id,
        action: 'User login',
        description: `${user.name} logged in`,
      },
    });

    return {
      user: publicUser(user),
      accessToken: signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      }),
      refreshToken: refresh.token,
    };
  });

  app.post('/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid refresh token' });
    }

    const tokenHash = hashToken(parsed.data.refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    const next = createRefreshToken();
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { id: stored.id } }),
      prisma.refreshToken.create({
        data: { tokenHash: next.tokenHash, userId: stored.userId, expiresAt: next.expiresAt },
      }),
    ]);

    return {
      user: publicUser(stored.user),
      accessToken: signAccessToken({
        sub: stored.user.id,
        email: stored.user.email,
        role: stored.user.role,
        name: stored.user.name,
      }),
      refreshToken: next.token,
    };
  });

  app.post('/logout', { preHandler: [authenticate] }, async (request) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (parsed.success) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(parsed.data.refreshToken) } });
    }
    await prisma.systemLog.create({
      data: {
        userId: request.user.sub,
        action: 'User logout',
        description: `${request.user.name} logged out`,
      },
    });
    return { ok: true };
  });

  app.get('/me', { preHandler: [authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) return { user: null };
    return { user: publicUser(user) };
  });

  app.patch('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid name or email' });
    }

    const email = parsed.data.email.toLowerCase();
    const clash = await prisma.user.findFirst({
      where: { email, NOT: { id: request.user.sub } },
    });
    if (clash) {
      return reply.code(409).send({ error: 'Email already in use' });
    }

    const user = await prisma.user.update({
      where: { id: request.user.sub },
      data: { name: parsed.data.name.trim(), email },
    });

    await prisma.systemLog.create({
      data: {
        userId: user.id,
        action: 'Update profile',
        description: `${user.name} updated account information`,
      },
    });

    return { user: publicUser(user) };
  });

  app.patch('/password', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = passwordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'New password must be at least 8 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
    });
    await prisma.systemLog.create({
      data: {
        userId: user.id,
        action: 'Change password',
        description: `${user.name} changed their password`,
      },
    });

    return { ok: true };
  });
}
