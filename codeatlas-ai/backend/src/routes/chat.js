import express from "express";
import { jobs } from "../services/cache.js";
import { answerRepoQuestion } from "../services/claude.js";

const router = express.Router();

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "does", "do", "this", "that", "for", "of",
  "in", "on", "to", "and", "or", "what", "where", "which", "how", "file",
  "repo", "repository", "code", "used", "use", "i", "it",
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Rank files by simple keyword overlap between the question and path/summary. */
function rankRelevantFiles(question, nodes, topN = 4) {
  const qTokens = new Set(tokenize(question));
  const scored = nodes.map((n) => {
    const haystack = tokenize(`${n.path} ${n.summary}`);
    let score = 0;
    for (const t of haystack) if (qTokens.has(t)) score += 1;
    // Small boost for filename tokens matching directly.
    return { node: n, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const withScore = scored.filter((s) => s.score > 0);
  const pool = withScore.length > 0 ? withScore : scored;
  return pool.slice(0, topN).map((s) => s.node);
}

router.post("/chat", async (req, res) => {
  const { jobId, question, history } = req.body || {};
  if (!jobId || !question) {
    return res.status(400).json({ error: "Missing 'jobId' or 'question'." });
  }
  const job = jobs.get(jobId);
  if (!job || job.status !== "done") {
    return res.status(404).json({ error: "Analysis not found or not finished yet." });
  }
  const graph = job.result;

  const topFiles = rankRelevantFiles(question, graph.nodes, 4);
  const contextFiles = topFiles.map((n) => ({
    path: n.path,
    summary: n.summary,
    content: graph.contentByPath[n.path]?.slice(0, 4000) || "",
  }));

  try {
    const result = await answerRepoQuestion({
      question,
      contextFiles,
      history: (history || []).slice(-6),
    });
    // Only keep sources that were actually offered as context, per spec
    // ("render Sources chips from the file list the model was actually given").
    const validPaths = new Set(contextFiles.map((f) => f.path));
    const sources = result.sources.filter((s) => validPaths.has(s));
    res.json({ answer: result.answer, sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
