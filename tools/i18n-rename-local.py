# rename a local `t` to NEW on lines A..B of FILE, keeping dictionary reads `t.<topKey>` and import lines (codemod helper)
import re, sys
f, a, b, new = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
keys = open('/tmp/claude-1000/-home-xaviel-dev2-tu-gasolina-rd/9faabc7a-3d91-4632-ae6a-50396be3f212/scratchpad/dictkeys.txt').read().split()
pat = re.compile(r"(?<![.\w$'\"])t\b(?!\.(?:%s)\b)(?!['\"])" % '|'.join(keys))
lines = open(f).read().split('\n')
for i in range(a - 1, min(b, len(lines))):
    if lines[i].lstrip().startswith('import '):
        continue
    lines[i] = pat.sub(new, lines[i])
open(f, 'w').write('\n'.join(lines))
