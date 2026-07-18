import express from "express";
import { EventEmitter } from "node:events";
import { v4 as uuid } from "uuid";
import { jobs, repoCache, repoKey } from "../services/cache.js";
import { loadLatestForRepo } from "../services/store.js";

const router = express.Router();

function stripForClient(graph) {
  const { allRepoPaths, ...clientGraph } = graph;
  return clientGraph;
}

// GET /api/shared?owner=X&repo=Y
// Resolves a shared link straight to a previously completed analysis -
// the visiting developer gets the full result instantly, without waiting
// on the pipeline or spending any Claude/GitHub API calls of their own.
router.get("/shared", async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) {
    return res.status(400).json({ error: "Missing 'owner' or 'repo' query param." });
  }

  const persisted = await loadLatestForRepo(owner, repo);
  if (!persisted?.graph) {
    return res.status(404).json({
      error: "No analysis of this repo has been saved on this server yet.",
    });
  }

  const { graph, overview } = persisted;

  // Hydrate a normal, fully-formed job so chat / file-detail / Explore
  // Project all work immediately - exactly as if this person had just run
  // the analysis themselves, just without the wait or the AI cost.
  const id = uuid();
  const job = {
    id,
    emitter: new EventEmitter(),
    status: "done",
    stage: null,
    error: null,
    result: graph,
    overview: overview || undefined,
  };
  jobs.set(id, job);
  repoCache.set(repoKey(graph.owner, graph.repo, graph.sha), graph);

  res.json({ jobId: id, graph: stripForClient(graph) });
});

export default router;
