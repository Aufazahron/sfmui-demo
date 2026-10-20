import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '@prisma/client';
import { verifyAccessToken, type AccessPayload } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: AccessPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    request.user = verifyAccessToken(header.slice(7));
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  };
}
