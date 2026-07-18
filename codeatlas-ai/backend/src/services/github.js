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

/** Number of commits touching a given path (capped at `perPage`, and
 * bounded to a recent time window). Kept for reference/reuse, but the
 * analysis pipeline uses getRecentChangeFrequency() instead - see below
 * for why. */
export async function getCommitCountForPath(owner, repo, path, since, timeoutMs = 8000) {
  const params = new URLSearchParams({
    path,
    per_page: "100",
  });
  if (since) params.set("since", since);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?${params.toString()}`,
      { headers: authHeaders(), signal: controller.signal }
    );
    if (!res.ok) return 0;
    const link = res.headers.get("link");
    const data = await res.json();
    if (link && link.includes('rel="last"')) {
      const m = link.match(/[?&]page=(\d+)>; rel="last"/);
      if (m) return parseInt(m[1], 10) * 100;
    }
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds a repo-wide "how often was this file touched recently" map from a
 * fixed sample of the most recent commits, instead of asking GitHub
 * "how many commits touched this exact file" once per file.
 *
 * Why: a per-path history query (getCommitCountForPath above) requires
 * GitHub to walk commit history filtered by path, which is slow and gets
 * slower the longer the repo's history is - and doing it once per file
 * means the risk-scoring stage's total time scales with file count, which
 * is exactly what made large repos slow to analyze.
 *
 * Looking up a specific commit by SHA, by contrast, is a fast direct
 * lookup with no history walk. So instead: fetch a fixed sample of recent
 * commit SHAs (one cheap paginated call), then fetch each commit's changed
 * files in parallel (fast per-request), and tally which paths show up.
 * Total cost is now a fixed sample size, not "number of files in the repo".
 */
export async function getRecentChangeFrequency(owner, repo, sha, commitLimit = 150, concurrency = 15) {
  const shas = [];
  try {
    let page = 1;
    while (shas.length < commitLimit) {
      const perPage = Math.min(100, commitLimit - shas.length);
      const data = await ghFetch(
        `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(sha)}&per_page=${perPage}&page=${page}`
      );
      if (!Array.isArray(data) || data.length === 0) break;
      shas.push(...data.map((c) => c.sha));
      if (data.length < perPage) break;
      page++;
    }
  } catch {
    return new Map();
  }

  const counts = new Map();
  let i = 0;
  async function worker() {
    while (i < shas.length) {
      const idx = i++;
      try {
        const detail = await ghFetch(`/repos/${owner}/${repo}/commits/${shas[idx]}`);
        for (const f of detail.files || []) {
          counts.set(f.filename, (counts.get(f.filename) || 0) + 1);
        }
      } catch {
        // One bad commit lookup shouldn't take the rest down with it.
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, shas.length || 1) }, worker)
  );
  return counts;
}

/** Fetches the repo's rendered-default README via GitHub's dedicated readme
 * endpoint (handles README.md / README.rst / no-extension / casing for us).
 * Returns null if the repo has no README. */
export async function getReadme(owner, repo, sha) {
  try {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/readme?ref=${encodeURIComponent(sha)}`,
      { headers: authHeaders() }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.content) return null;
    const content = Buffer.from(data.content, data.encoding || "base64").toString("utf-8");
    return { path: data.path, content };
  } catch {
    return null;
  }
}

/** Byte-count per language, as reported by GitHub's linguist analysis. */
export async function getLanguages(owner, repo) {
  try {
    const data = await ghFetch(`/repos/${owner}/${repo}/languages`);
    const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(data)
      .map(([name, bytes]) => ({ name, percent: Math.round((bytes / total) * 100) }))
      .sort((a, b) => b.percent - a.percent);
  } catch {
    return [];
  }
}

/** Recent commit log with author info, used for the "recent changes" and
 * "recent contributions" views. */
export async function getRecentCommits(owner, repo, sha, limit = 12) {
  try {
    const data = await ghFetch(
      `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(sha)}&per_page=${limit}`
    );
    return data.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: (c.commit?.message || "").split("\n")[0],
      authorName: c.commit?.author?.name || c.author?.login || "Unknown",
      authorLogin: c.author?.login || null,
      avatarUrl: c.author?.avatar_url || null,
      date: c.commit?.author?.date || null,
      url: c.html_url,
    }));
  } catch {
    return [];
  }
}
