/**
 * ADR-59 (IMP 16102026): every permission read, request or "open the settings" goes through lib/permissions. This
 * test fails the day somebody calls the system directly from a screen or a lib file — which is how the app ended up
 * with a dozen unconnected calls, three of them in cold (docs/imp-16102026/permissions-inventory.md).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../..');

/** The calls that touch a system permission. */
const FORBIDDEN = [
  /\bgetForegroundPermissionsAsync\b/,
  /\brequestForegroundPermissionsAsync\b/,
  /\bgetBackgroundPermissionsAsync\b/,
  /\brequestBackgroundPermissionsAsync\b/,
  /\bgetCameraPermissionsAsync\b/,
  /\brequestCameraPermissionsAsync\b/,
  /\brequestPermissionsAsync\b/,
  /\bgetPermissionsAsync\b/,
  /\bhasServicesEnabledAsync\b/,
  /\bLinking\.openSettings\b/,
  /\bnavigator\.permissions\b/,
  /\bpresentPermissionsPicker\b/,
];

function sourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', 'app', 'components', 'lib', 'hooks', 'api'], { cwd: ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .filter((f) => /\.(tsx?|js)$/.test(f))
    // The registry is the one place allowed, and the generated cloud types mention nothing of this kind.
    .filter((f) => !f.startsWith('lib/permissions/'));
}

describe('permissions only through lib/permissions', () => {
  it('no screen or lib file calls a system permission API directly', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments may talk about them
        for (const re of FORBIDDEN) if (re.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
