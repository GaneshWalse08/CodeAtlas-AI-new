import express from "express";
import { EventEmitter } from "node:events";
import { v4 as uuid } from "uuid";
import {
  parseRepoUrl,
  getRepoMeta,
  getLatestSha,
  getFileTree,
  isRelevantSourceFile,
  getRawFileContent,
  getCommitCountForPath,
  GitHubError,
} from "../services/github.js";
import { extractImports, hasMatchingTest, groupByFolder } from "../services/parser.js";
import { summarizeFilesBatch, explainRisk } from "../services/claude.js";
import { computeRiskBucket } from "../services/risk.js";
import { repoCache, jobs, repoKey } from "../services/cache.js";
import { EXAMPLE_REPOS } from "../services/examples.js";

const router = express.Router();

const MAX_FILES = 300;
const SUMMARY_BATCH_SIZE = 5;
const CONCURRENCY = 8;

router.get("/examples", (_req, res) => {
  res.json(EXAMPLE_REPOS);
});

// Run an array of async tasks with a concurrency cap.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const STAGES = [
  "fetching",
  "structure",
  "summaries",
  "risk",
];

function makeJob() {
  const id = uuid();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);
  const job = {
    id,
    emitter,
    status: "pending",
    stage: null,
    error: null,
    result: null,
  };
  jobs.set(id, job);
  return job;
}

function emitStage(job, stage, status, extra = {}) {
  job.stage = stage;
  const payload = { type: "stage", stage, status, ...extra };
  job.emitter.emit("event", payload);
}

function emitCaption(job, caption) {
  job.emitter.emit("event", { type: "caption", caption });
}

/** allRepoPaths is only needed server-side (manifest lookup for the project
 * overview) - never send it down to the browser. */
function stripForClient(graph) {
  const { allRepoPaths, ...clientGraph } = graph;
  return clientGraph;
}

async function runPipeline(job, owner, repo) {
  try {
    emitStage(job, "fetching", "active");
    const meta = await getRepoMeta(owner, repo);
    const sha = await getLatestSha(owner, repo, meta.defaultBranch);
    const key = repoKey(owner, repo, sha);

    const cached = repoCache.get(key);
    if (cached) {
      for (const s of STAGES) emitStage(job, s, "done");
      job.result = cached;
      job.status = "done";
      job.emitter.emit("event", { type: "done", graph: stripForClient(cached) });
      return;
    }

    const fullTree = await getFileTree(owner, repo, sha);
    const relevant = fullTree.filter((f) => isRelevantSourceFile(f.path, f.size));
    const truncatedForSize = relevant.length > MAX_FILES;
    const files = relevant.slice(0, MAX_FILES);
    const allPaths = files.map((f) => f.path);

    emitStage(job, "fetching", "done", { fileCount: files.length });
    emitCaption(job, `Found ${files.length} source files to analyze`);

    // --- Stage 2: structure / dependency extraction ---
    emitStage(job, "structure", "active");
    const contents = await mapWithConcurrency(files, CONCURRENCY, async (f) => {
      const content = await getRawFileContent(owner, repo, sha, f.path);
      return { path: f.path, content: content || "" };
    });
    const contentByPath = new Map(contents.map((c) => [c.path, c.content]));

    const edges = [];
    for (const { path, content } of contents) {
      if (!content) continue;
      const targets = extractImports(path, content, allPaths);
      for (const t of targets) edges.push({ source: path, target: t });
    }
    emitStage(job, "structure", "done", { edgeCount: edges.length });
    emitCaption(job, "Larger repos can take up to 30 seconds");

    // --- Stage 3: AI summaries (batched) ---
    emitStage(job, "summaries", "active");
    const summaries = new Map();
    const batches = [];
    for (let i = 0; i < contents.length; i += SUMMARY_BATCH_SIZE) {
      batches.push(contents.slice(i, i + SUMMARY_BATCH_SIZE));
    }
    await mapWithConcurrency(batches, 3, async (batch) => {
      const nonEmpty = batch.filter((b) => b.content);
      if (nonEmpty.length === 0) return;
      try {
        const result = await summarizeFilesBatch(nonEmpty);
        for (const [p, s] of result) summaries.set(p, s);
      } catch (e) {
        console.error(
          `[analyze] summary batch failed for [${nonEmpty.map((b) => b.path).join(", ")}]:`,
          e.message
        );
        for (const b of nonEmpty) summaries.set(b.path, "Summary unavailable (AI request failed).");
      }
    });
    emitStage(job, "summaries", "done");
    emitCaption(job, "Still working - parsing dependencies");

    // --- Stage 4: risk scoring ---
    emitStage(job, "risk", "active");
    const changeCounts = await mapWithConcurrency(files, 4, async (f) => {
      const count = await getCommitCountForPath(owner, repo, f.path);
      return { path: f.path, count };
    });
    const maxChange = Math.max(1, ...changeCounts.map((c) => c.count));
    const riskByPath = new Map();
    for (const { path, count } of changeCounts) {
      const tests = hasMatchingTest(path, allPaths);
      const { score, bucket } = computeRiskBucket(count, tests, maxChange);
      riskByPath.set(path, { changeCount: count, hasTests: tests, score, bucket });
    }
    emitStage(job, "risk", "done");

    // --- Assemble graph payload ---
    const folders = groupByFolder(allPaths);
    const nodes = files.map((f) => {
      const risk = riskByPath.get(f.path);
      const parts = f.path.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "/";
      return {
        id: f.path,
        path: f.path,
        name: parts[parts.length - 1],
        folder,
        size: f.size,
        summary: summaries.get(f.path) || "Summary unavailable.",
        risk,
      };
    });

    const graph = {
      owner,
      repo,
      sha,
      analyzedAt: new Date().toISOString(),
      truncated: truncatedForSize,
      totalSourceFiles: relevant.length,
      nodes,
      edges,
      folders: [...folders.keys()],
      contentByPath: Object.fromEntries(contentByPath),
      // Full repo path list (not just source files) - used server-side to
      // locate manifest files (package.json etc.) for the project overview.
      // Stripped before sending to the client - see stripForClient().
      allRepoPaths: fullTree.map((f) => f.path),
    };

    repoCache.set(key, graph);
    job.result = graph;
    job.status = "done";
    job.emitter.emit("event", { type: "done", graph: stripForClient(graph) });
  } catch (err) {
    job.status = "error";
    job.error = err.message;
    const stage = job.stage || "fetching";
    emitStage(job, stage, "error", { message: err.message });
    job.emitter.emit("event", { type: "error", message: err.message });
  }
}

router.post("/analyze", async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing 'url' in request body." });
  }
  const parsed = parseRepoUrl(url);
  if (!parsed) {
    return res.status(400).json({ error: "That doesn't look like a GitHub repo URL." });
  }
  const job = makeJob();
  res.json({ jobId: job.id });
  // Fire and forget; client subscribes via SSE.
  runPipeline(job, parsed.owner, parsed.repo);
});

router.get("/analyze/:jobId/stream", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).end();

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Replay current status immediately in case client subscribed late.
  if (job.status === "done") {
    send({ type: "done", graph: job.result });
    return res.end();
  }
  if (job.status === "error") {
    send({ type: "error", message: job.error });
    return res.end();
  }

  const listener = (payload) => {
    send(payload);
    if (payload.type === "done" || payload.type === "error") {
      res.end();
    }
  };
  job.emitter.on("event", listener);

  req.on("close", () => {
    job.emitter.off("event", listener);
  });
});

router.get("/repo/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found." });
  if (job.status === "error") return res.status(500).json({ error: job.error });
  if (job.status !== "done") return res.status(202).json({ status: job.status });
  res.json(stripForClient(job.result));
});

export default router;
