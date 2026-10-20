export type UserRole = 'super_admin' | 'operator';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export function roleLabel(role: UserRole) {
  return role === 'super_admin' ? 'Super Admin' : 'Operator';
}

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'U';
}
