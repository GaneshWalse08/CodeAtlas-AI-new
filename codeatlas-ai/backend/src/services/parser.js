// Lightweight regex-based import extraction (per spec: full AST parsing is a
// stretch goal — this is enough to build a demo-quality dependency graph).

const JS_IMPORT_RE =
  /(?:import\s+(?:[\w*{}\s,]+\s+from\s+)?|require\s*\(\s*|export\s+(?:[\w*{}\s,]+\s+from\s+)?)['"]([^'"]+)['"]/g;
const PY_IMPORT_RE =
  /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))/gm;

function stripExt(p) {
  return p.replace(/\.(js|jsx|ts|tsx|mjs|cjs|py)$/i, "");
}

/** Resolve a relative import spec against the importing file's directory,
 * then try to match it against the known repo file paths. */
function resolveRelative(fromPath, spec, allPaths) {
  if (!spec.startsWith(".")) return null; // skip bare/package imports
  const dir = fromPath.split("/").slice(0, -1);
  const parts = spec.split("/");
  const stack = [...dir];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  const base = stack.join("/");
  const candidates = [
    base,
    `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`,
    `${base}.py`,
    `${base}/index.js`, `${base}/index.ts`, `${base}/__init__.py`,
  ];
  for (const c of candidates) {
    const hit = allPaths.find((p) => p === c || stripExt(p) === stripExt(c));
    if (hit) return hit;
  }
  return null;
}

function resolvePythonModule(fromPath, mod, allPaths) {
  const modPath = mod.replace(/\./g, "/");
  const candidates = [`${modPath}.py`, `${modPath}/__init__.py`];
  for (const c of candidates) {
    const hit = allPaths.find((p) => p.endsWith(c));
    if (hit) return hit;
  }
  return null;
}

/**
 * Extract import edges for one file's contents.
 * Returns array of resolved target paths (only edges we could map to a real
 * file in the repo; unresolved external packages are dropped, per spec —
 * files with unresolvable imports still render, just without those edges).
 */
export function extractImports(path, content, allPaths) {
  const ext = path.split(".").pop().toLowerCase();
  const targets = new Set();

  if (["js", "jsx", "ts", "tsx", "mjs", "cjs"].includes(ext)) {
    let m;
    JS_IMPORT_RE.lastIndex = 0;
    while ((m = JS_IMPORT_RE.exec(content))) {
      const resolved = resolveRelative(path, m[1], allPaths);
      if (resolved && resolved !== path) targets.add(resolved);
    }
  } else if (ext === "py") {
    let m;
    PY_IMPORT_RE.lastIndex = 0;
    while ((m = PY_IMPORT_RE.exec(content))) {
      const mod = (m[1] || m[2] || "").split(",")[0].trim();
      if (!mod) continue;
      const resolved = resolvePythonModule(path, mod, allPaths);
      if (resolved && resolved !== path) targets.add(resolved);
    }
  }
  return [...targets];
}

/** Heuristic: does a matching test file exist for this source file? */
export function hasMatchingTest(path, allPaths) {
  const base = path.split("/").pop();
  const stem = stripExt(base);
  const dir = path.split("/").slice(0, -1).join("/");
  const patterns = [
    `${stem}.test.`, `${stem}.spec.`, `test_${stem}.py`, `${stem}_test.py`,
  ];
  return allPaths.some((p) => {
    if (p === path) return false;
    const pBase = p.split("/").pop();
    const inTestsDir = p.includes("__tests__/") || p.includes("/tests/") || p.includes("/test/");
    return (
      patterns.some((pat) => pBase.startsWith(pat)) ||
      (inTestsDir && pBase.includes(stem))
    );
  });
}

/** Groups a flat file list into a folder tree structure for React Flow group nodes. */
export function groupByFolder(paths) {
  const folders = new Map(); // folder path -> [file paths]
  for (const p of paths) {
    const parts = p.split("/");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "/";
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push(p);
  }
  return folders;
}
