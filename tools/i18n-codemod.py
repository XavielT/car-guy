# One-off codemod (IMP 30092026 Phase 3A): `import { es } from '…/i18n/es'` → `import { t } from '…/i18n'`,
# and every dictionary read `es.x` → `t.x`. Leaves `obj.es` (catalogue labels) and strings like 'es-DO' alone.
import re, subprocess, sys
files = subprocess.run(['git', 'ls-files', 'app', 'components', 'lib'], capture_output=True, text=True).stdout.split()
imp = re.compile(r"import \{ es \} from '([^']*?)i18n/es';")
use = re.compile(r"(?<![.\w$'\"`-])es\.(?=[a-zA-Z_])")
changed = 0
for f in files:
    if not f.endswith(('.ts', '.tsx')) or f.startswith('lib/i18n/'):
        continue
    s = open(f).read()
    if not imp.search(s):
        continue
    s2 = imp.sub(lambda m: f"import {{ t }} from '{m.group(1)}i18n';", s)
    # Only code, not the import line itself; comments mentioning es.ts stay as they are.
    s2 = use.sub(lambda m: m.group(0) if False else 't.', s2)
    s2 = s2.replace('t.ts', 'es.ts') if 't.ts' in s2 and 'es.ts' in s else s2
    if s2 != s:
        open(f, 'w').write(s2)
        changed += 1
print('files changed:', changed)
