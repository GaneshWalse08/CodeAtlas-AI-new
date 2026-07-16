import fetch from "node-fetch";

const GITHUB_API = "https://api.github.com";

function authHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "codeatlas-ai",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

/** Parse a GitHub URL like https://github.com/owner/repo into { owner, repo } */
export function parseRepoUrl(url) {
  const cleaned = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(
    /github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function ghFetch(path) {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: authHeaders() });
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    throw new GitHubError(
      remaining === "0"
        ? "GitHub API rate limit exceeded. Add a GITHUB_TOKEN to the backend .env to raise the limit."
        : "GitHub API request was forbidden.",
      429
    );
  }
  if (res.status === 404) {
    throw new GitHubError("Repository not found (is it public?).", 404);
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error: ${res.status}`, res.status);
  }
  return res.json();
}

/** Get the default branch's latest commit SHA (used as a cache key) */
export async function getRepoMeta(owner, repo) {
  const data = await ghFetch(`/repos/${owner}/${repo}`);
  return {
    defaultBranch: data.default_branch,
    description: data.description,
    stars: data.stargazers_count,
    sizeKb: data.size,
  };
}

export async function getLatestSha(owner, repo, branch) {
  const data = await ghFetch(
    `/repos/${owner}/${repo}/commits/${branch}?per_page=1`
  );
  return data.sha;
}

/** Recursive file tree. Returns array of { path, type, size } for blobs only. */
export async function getFileTree(owner, repo, sha) {
  const data = await ghFetch(
    `/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`
  );
  if (data.truncated) {
    // Repo is very large; we still proceed but flag it upstream via count.
  }
  return (data.tree || [])
    .filter((n) => n.type === "blob")
    .map((n) => ({ path: n.path, size: n.size || 0 }));
}

const SOURCE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "go", "rb", "java", "kt", "c", "cpp", "h", "hpp", "cs",
  "rs", "php", "swift", "scala",
]);

const SKIP_PATH_PARTS = [
  "node_modules/", "vendor/", "dist/", "build/", ".git/", "coverage/",
  "__pycache__/", ".next/", ".venv/", "venv/", "target/",
];

export function isRelevantSourceFile(path, size) {
  if (size > 100 * 1024) return false; // >100KB, skip per spec guardrail
  if (SKIP_PATH_PARTS.some((p) => path.includes(p))) return false;
  const ext = path.split(".").pop().toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

export async function getRawFileContent(owner, repo, sha, path) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${encodeURI(
    path
  )}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

/** Number of commits touching a given path (capped at `perPage` for speed). */
export async function getCommitCountForPath(owner, repo, path, since) {
  const params = new URLSearchParams({
    path,
    per_page: "100",
  });
  if (since) params.set("since", since);
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?${params.toString()}`,
      { headers: authHeaders() }
    );
    if (!res.ok) return 0;
    const link = res.headers.get("link");
    const data = await res.json();
    // If there's a "last" page link, estimate from it; else count directly.
    if (link && link.includes('rel="last"')) {
      const m = link.match(/[?&]page=(\d+)>; rel="last"/);
      if (m) return parseInt(m[1], 10) * 100; // rough upper-bound estimate
    }
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}
