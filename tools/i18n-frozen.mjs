// Lists reads of the dictionary (`es.` before the codemod, `t.` after) that run at module load —
// outside every function — and so would freeze in the first launch's language (ADR-39).
//   node tools/i18n-frozen.mjs [es|t]
import ts from 'typescript';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ident = process.argv[2] ?? 't';
const files = execSync(`git ls-files --cached --others --exclude-standard 'app/**/*.ts' 'app/**/*.tsx' 'components/**/*.ts' 'components/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' 'hooks/**/*.ts' 'hooks/**/*.tsx'`, { encoding: 'utf8' })
  .split('\n').filter((f, i, all) => f && existsSync(f) && all.indexOf(f) === i && !f.startsWith('lib/i18n/'));
const hits = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!new RegExp(`\\b${ident}\\.`).test(src)) continue;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node, inFn) => {
    const fn = inFn || ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration?.(node);
    if (!inFn && ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === ident) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
      hits.push(`${file}:${line + 1}: ${src.split('\n')[line].trim().slice(0, 110)}`);
    }
    ts.forEachChild(node, (c) => visit(c, fn));
  };
  visit(sf, false);
}
console.log(hits.join('\n'));
console.error(`${hits.length} module-level read(s) of ${ident}.`);
