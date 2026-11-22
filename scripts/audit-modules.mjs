import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = fileURLToPath(new URL("..", import.meta.url)),
  files = execFileSync("git", [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
  ], { cwd: root, encoding: "utf8" }).trim().split("\n");
const source = files.filter((f) =>
  fs.existsSync(path.join(root, f)) && /\.(ts|tsx|mjs|js)$/.test(f) &&
  !f.endsWith(".d.ts")
);
const edges = new Map();
const opts = {
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true,
  resolveJsonModule: true,
  allowImportingTsExtensions: true,
};
for (const file of source) {
  const abs = path.join(root, file),
    text = fs.readFileSync(abs, "utf8"),
    ast = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true);
  const deps = [];
  function visit(n) {
    let s;
    if (
      (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
      n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)
    ) s = n.moduleSpecifier.text;
    else if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] &&
      ts.isStringLiteral(n.arguments[0])
    ) s = n.arguments[0].text;
    if (s?.startsWith(".")) {
      const resolved = ts.resolveModuleName(s, abs, opts, ts.sys).resolvedModule
        ?.resolvedFileName;
      if (resolved && !path.relative(root, resolved).startsWith("..") && !path.isAbsolute(path.relative(root, resolved))) {
        deps.push(path.relative(root, resolved).split(path.sep).join("/"));
      } else {
        const p = path.relative(root, path.resolve(path.dirname(abs), s)).split(path.sep).join("/");
        if (fs.existsSync(path.join(root, p))) deps.push(p);
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(ast);
  edges.set(file, deps);
}
function reach(roots) {
  const visited = new Set(), q = [...roots];
  while (q.length) {
    const f = q.pop();
    if (visited.has(f)) continue;
    visited.add(f);
    q.push(...(edges.get(f) || []));
  }
  return visited;
}
const browser = reach(["src/main.tsx"]);
const backend = reach(
  source.filter((f) => /^supabase\/functions\/[^/]+\/index\.ts$/.test(f)),
);
const tooling = reach(
  source.filter((f) => f.startsWith("scripts/") && !f.includes(".test."))
    .concat(["vite.config.ts", "practiceTutorPlugin.ts"]),
);
const orphan = source.filter((f) =>
  f.startsWith("src/") && !/\.test\.|src\/test\//.test(f) && !browser.has(f) &&
  !backend.has(f) && !tooling.has(f)
);
console.log(
  JSON.stringify(
    {
      browserFiles: browser.size,
      backendFiles: backend.size,
      toolFiles: tooling.size,
      testOnlyOrUnreachable: orphan,
    },
    null,
    2,
  ),
);
// This is an inventory, not an automatic deletion policy. Review each candidate.
