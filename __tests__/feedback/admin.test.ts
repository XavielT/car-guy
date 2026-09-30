/**
 * Roles (sql/024): the admin is a role on the profile, not an email. The app's
 * type matches the SQL's check constraint, the admin panel functions all refuse
 * non-admins first, and no feedback policy still names an email.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isRole, ROLES } from '@/lib/cloud/roles';

const sql = (f: string) =>
  readFileSync(join(__dirname, '..', '..', 'sql', f), 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

it('isRole accepts exactly the three roles', () => {
  expect(ROLES).toEqual(['admin', 'member', 'premium']);
  for (const r of ROLES) expect(isRole(r)).toBe(true);
  for (const r of ['Admin', 'owner', '', null, undefined, 1]) expect(isRole(r)).toBe(false);
});

it('the SQL check constraint allows the same three roles', () => {
  expect(sql('024_roles_admin.sql')).toContain("check (role in ('admin', 'member', 'premium'))");
});

it('every admin panel function refuses non-admins before doing anything', () => {
  const s = sql('024_roles_admin.sql');
  for (const fn of ['admin_stats', 'admin_users', 'admin_set_role']) {
    const body = s.slice(s.indexOf(`function carguy.${fn}(`));
    const firstStatement = body.slice(body.indexOf('begin'), body.indexOf('begin') + 120);
    expect(firstStatement).toMatch(/if not carguy\.is_admin\(\) then\s+raise exception 'forbidden'/);
  }
});

it('the feedback policies are role-based now (024 replaces 021 and its storage half)', () => {
  const s = sql('024_roles_admin.sql') + sql('024_roles_admin_storage.shared.sql');
  expect(s).toMatch(/feedback_select_own[\s\S]*carguy\.is_admin\(\)/);
  expect(s).toMatch(/feedback_update_admin[\s\S]*carguy\.is_admin\(\)/);
  expect(s).toMatch(/carguy_feedback_admin_select[\s\S]*carguy\.is_admin\(\)/);
  expect(s).not.toMatch(/auth\.jwt\(\)\) ->> 'email'/);
});
