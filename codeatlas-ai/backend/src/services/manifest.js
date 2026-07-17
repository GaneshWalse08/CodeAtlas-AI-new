// Best-effort dependency detection from common manifest files. Deliberately
// simple (no real TOML/lockfile parsing) - this feeds a quick tech-stack
// list, not a security audit.

export const MANIFEST_FILENAMES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Gemfile",
  "composer.json",
];

const SKIP_DIR_PARTS = ["node_modules/", "vendor/", ".git/"];

/** Find up to `limit` manifest files anywhere in the repo's file list,
 * preferring ones closer to the root. */
export function findManifestPaths(allPaths, limit = 4) {
  const matches = allPaths.filter((p) => {
    if (SKIP_DIR_PARTS.some((d) => p.includes(d))) return false;
    const name = p.split("/").pop();
    return MANIFEST_FILENAMES.includes(name);
  });
  matches.sort((a, b) => a.split("/").length - b.split("/").length);
  return matches.slice(0, limit);
}

function parsePackageJson(content) {
  try {
    const json = JSON.parse(content);
    return [
      ...Object.keys(json.dependencies || {}),
      ...Object.keys(json.devDependencies || {}),
    ];
  } catch {
    return [];
  }
}

function parseRequirementsTxt(content) {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/[=<>!~;]/)[0].trim())
    .filter(Boolean);
}

function parsePyprojectToml(content) {
  // Very rough: pull lines under a [tool.poetry.dependencies] /
  // [project] dependencies-style block that look like `name = ...` or `"name"`.
  const names = new Set();
  const lines = content.split("\n");
  let inDeps = false;
  for (const line of lines) {
    if (/^\[.*depend/i.test(line.trim())) {
      inDeps = true;
      continue;
    }
    if (/^\[/.test(line.trim())) {
      inDeps = false;
      continue;
    }
    if (inDeps) {
      const m = line.match(/^\s*["']?([A-Za-z0-9_.-]+)["']?\s*=/);
      if (m && m[1].toLowerCase() !== "python") names.add(m[1]);
    }
  }
  return [...names];
}

function parseGoMod(content) {
  const names = [];
  for (const line of content.split("\n")) {
    const m = line.trim().match(/^([\w.\-/]+)\s+v[\d.]/);
    if (m) names.push(m[1].split("/").pop());
  }
  return names;
}

function parseGemfile(content) {
  const names = [];
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*gem\s+["']([\w\-]+)["']/);
    if (m) names.push(m[1]);
  }
  return names;
}

function parseComposerJson(content) {
  try {
    const json = JSON.parse(content);
    return Object.keys(json.require || {}).filter((k) => k !== "php");
  } catch {
    return [];
  }
}

/** Parse a manifest file's content into a list of dependency names, based
 * on its filename. */
export function parseManifest(path, content) {
  const name = path.split("/").pop();
  switch (name) {
    case "package.json":
      return parsePackageJson(content);
    case "requirements.txt":
      return parseRequirementsTxt(content);
    case "pyproject.toml":
      return parsePyprojectToml(content);
    case "go.mod":
      return parseGoMod(content);
    case "Gemfile":
      return parseGemfile(content);
    case "composer.json":
      return parseComposerJson(content);
    default:
      return [];
  }
}
