import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");

function safeName(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function fileFor(owner, repo, sha) {
  return path.join(DATA_DIR, `${safeName(owner)}__${safeName(repo)}__${safeName(sha)}.json`);
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/** Persists a completed analysis to disk, keyed by owner/repo/commit sha.
 * This is what makes a shared link actually skip re-analysis: the graph
 * survives server restarts and isn't bound to any one job/session. */
export async function saveAnalysis(graph) {
  try {
    await ensureDataDir();
    const file = fileFor(graph.owner, graph.repo, graph.sha);
    await fs.writeFile(
      file,
      JSON.stringify({ graph, overview: null, savedAt: new Date().toISOString() })
    );
  } catch (e) {
    console.error("[store] failed to persist analysis:", e.message);
  }
}

/** Adds the (also AI-generated, also worth not re-paying for) Explore
 * Project overview to an already-saved analysis record. */
export async function saveOverview(owner, repo, sha, overview) {
  try {
    await ensureDataDir();
    const file = fileFor(owner, repo, sha);
    let existing = {};
    try {
      existing = JSON.parse(await fs.readFile(file, "utf-8"));
    } catch {
      // No analysis record yet - shouldn't normally happen since analysis
      // is always saved first, but don't let it break anything.
    }
    existing.overview = overview;
    existing.savedAt = new Date().toISOString();
    await fs.writeFile(file, JSON.stringify(existing));
  } catch (e) {
    console.error("[store] failed to persist overview:", e.message);
  }
}

export async function loadBySha(owner, repo, sha) {
  try {
    const raw = await fs.readFile(fileFor(owner, repo, sha), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Finds the most recently saved analysis for owner/repo, regardless of
 * exact commit sha - a shared link should open "whatever's already been
 * analyzed here," not require pinning an exact commit. */
export async function loadLatestForRepo(owner, repo) {
  try {
    await ensureDataDir();
    const prefix = `${safeName(owner)}__${safeName(repo)}__`;
    const files = (await fs.readdir(DATA_DIR)).filter(
      (f) => f.startsWith(prefix) && f.endsWith(".json")
    );
    if (files.length === 0) return null;
    const withStats = await Promise.all(
      files.map(async (f) => {
        const stat = await fs.stat(path.join(DATA_DIR, f));
        return { f, mtime: stat.mtimeMs };
      })
    );
    withStats.sort((a, b) => b.mtime - a.mtime);
    const raw = await fs.readFile(path.join(DATA_DIR, withStats[0].f), "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("[store] failed to load analysis:", e.message);
    return null;
  }
}
