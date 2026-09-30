// Every `t.<dictionaryKey>` read must resolve to lib/i18n's `t`, not a local that shadows it (ADR-39 codemod check).
import ts from 'typescript';
import { readFileSync } from 'node:fs';
const cfgPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath, ts.sys.readFile).config, ts.sys, '.');
const program = ts.createProgram(cfg.fileNames, cfg.options);
const checker = program.getTypeChecker();
const keys = new Set(readFileSync(process.argv[2], 'utf8').split('\n'));
const bad = [];
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile || sf.fileName.includes('node_modules') || sf.fileName.includes('/lib/i18n/')) continue;
  const visit = (n) => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't' && keys.has(n.name.text)) {
      const sym = checker.getSymbolAtLocation(n.expression);
      const decl = sym?.declarations?.[0];
      const ok = decl && (ts.isImportSpecifier(decl) || ts.isImportClause(decl));
      if (!ok) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
        bad.push(`${sf.fileName.replace(process.cwd() + '/', '')}:${line + 1} t.${n.name.text} → ${decl ? ts.SyntaxKind[decl.kind] : 'unresolved'}`);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
console.log(bad.join('\n') || 'no shadowed dictionary reads');
