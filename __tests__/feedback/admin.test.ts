/**
 * The admin predicate (ADR-35) is the SQL's: lower(auth.jwt() ->> 'email') =
 * 'tecnologia@constructorasd.com'. The app only uses it to show the inbox; the
 * server enforces it — so the two must never drift.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('@/lib/cloud/auth', () => ({ useSession: () => ({ session: null }) }));

import { ADMIN_EMAIL, isAdminEmail } from '@/lib/cloud/admin';

describe('isAdminEmail', () => {
  it('matches the admin email in any case', () => {
    expect(isAdminEmail('tecnologia@constructorasd.com')).toBe(true);
    expect(isAdminEmail('Tecnologia@ConstructoraSD.com')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail('tecnologia@constructorasd.com.evil.do')).toBe(false);
    expect(isAdminEmail('otro@constructorasd.com')).toBe(false);
    expect(isAdminEmail(' tecnologia@constructorasd.com')).toBe(false); // the SQL does not trim either
  });

  it('is the same constant, lower-cased the same way, as every admin check in the SQL', () => {
    for (const file of ['sql/021_feedback.sql', 'sql/021_feedback_storage.shared.sql']) {
      const sql = readFileSync(join(__dirname, '..', '..', file), 'utf8')
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n');
      const checks = [...sql.matchAll(/lower\(\(select auth\.jwt\(\)\) ->> 'email'\) = '([^']+)'/g)].map((m) => m[1]);
      const emails = [...sql.matchAll(/'([^'\s]+@[^'\s]+)'/g)].map((m) => m[1]);
      expect(checks.length).toBeGreaterThan(0);
      expect(emails.length).toBe(checks.length);
      for (const email of checks) expect(email).toBe(ADMIN_EMAIL);
    }
  });
});
