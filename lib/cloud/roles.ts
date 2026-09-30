/**
 * Roles (sql/024): 'admin' (Xaviel), 'member' (everyone, the default) and
 * 'premium' (exists, unlocks nothing yet — no payments). Pure: the SQL check
 * constraint allows exactly these.
 */
export type Role = 'admin' | 'member' | 'premium';

export const ROLES: Role[] = ['admin', 'member', 'premium'];

export function isRole(v: unknown): v is Role {
  return v === 'admin' || v === 'member' || v === 'premium';
}
