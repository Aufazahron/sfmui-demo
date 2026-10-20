import { apiFetch } from './api';
import type { AuthUser, UserRole } from '@/types/auth';

export interface ManagedUser extends AuthUser {
  createdAt: string;
}

export async function fetchUsers() {
  return apiFetch('/api/users') as Promise<{ users: ManagedUser[] }>;
}

export async function createUser(payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  return apiFetch('/api/users', { method: 'POST', body: payload }) as Promise<{ user: ManagedUser }>;
}

export async function updateUser(id: string, payload: {
  name?: string;
  email?: string;
  role?: UserRole;
  password?: string;
}) {
  return apiFetch(`/api/users/${id}`, { method: 'PATCH', body: payload }) as Promise<{ user: ManagedUser }>;
}

export async function deleteUser(id: string) {
  return apiFetch(`/api/users/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>;
}

export async function updateProfile(payload: { name: string; email: string }) {
  return apiFetch('/api/auth/me', { method: 'PATCH', body: payload }) as Promise<{ user: AuthUser }>;
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return apiFetch('/api/auth/password', { method: 'PATCH', body: payload }) as Promise<{ ok: boolean }>;
}
