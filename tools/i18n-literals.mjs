// Spanish-looking string literals / JSX text outside the dictionaries (ADR-39 sweep).
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const files = execSync(`git ls-files 'app/**/*.tsx' 'app/**/*.ts' 'components/**/*.tsx' 'components/**/*.ts' 'lib/**/*.ts' 'lib/**/*.tsx'`, { encoding: 'utf8' })
  .split('\n').filter((f) => f && !f.startsWith('lib/i18n/') && !f.startsWith('app/dev/') && !f.startsWith('lib/dev/'));
const SPANISH = /[áéíóúñ¿¡]|\b(el|la|los|las|del|para|con|una|que|por|sin|tu|tus|más|carga|gomas|vehículo|guardar|borrar|usada|nuevo|nueva)\b/i;
const out = {};
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    let text = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text;
    else if (ts.isTemplateExpression(n)) text = n.head.text + n.templateSpans.map((s) => s.literal.text).join(' ');
    else if (ts.isJsxText(n)) text = n.text.trim();
    if (text && SPANISH.test(text) && /[a-z]{3}/i.test(text)) {
      const p = n.parent;
      const skip = ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || (ts.isCallExpression(p) && /recordError|recordNote|console\.|require/.test(p.expression.getText()));
      if (!skip) (out[f] ??= []).push(`${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}: ${JSON.stringify(text).slice(0, 90)}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
let total = 0;
for (const [f, hits] of Object.entries(out)) { total += hits.length; console.log(`${f} (${hits.length})\n  ` + hits.slice(0, 6).join('\n  ')); }
console.error('total', total, 'in', Object.keys(out).length, 'files');
