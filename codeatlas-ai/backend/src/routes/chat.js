import express from "express";
import { jobs } from "../services/cache.js";
import { answerRepoQuestion } from "../services/claude.js";

const router = express.Router();

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "does", "do", "this", "that", "for", "of",
  "in", "on", "to", "and", "or", "what", "where", "which", "how", "file",
  "repo", "repository", "code", "used", "use", "i", "it",
]);

// Broad, whole-repo questions ("explain the project", "give me a summary")
// can't be answered from 4 keyword-matched files - they need a map of the
// whole repo instead. These phrases route to overview mode.
const OVERVIEW_PATTERNS = [
  /\bproject\b/, /\boverview\b/, /\bsummar/, /\bexplain\b/, /\barchitecture\b/,
  /\bpurpose\b/, /\bwhole\b/, /\bentire\b/, /\bcodebase\b/, /\bwhat (does|is) this\b/,
  /\bhow (does|is) this (built|structured|organized)\b/, /\btech stack\b/,
];

// Files whose content is almost always worth including in an overview,
// regardless of keyword matching.
const ANCHOR_PATTERNS = [
  /^readme/i, /^package\.json$/i, /^requirements\.txt$/i, /^pyproject\.toml$/i,
  /^(main|app|server|index|manage)\.(py|js|ts|jsx|tsx)$/i,
];
const MAX_OVERVIEW_SUMMARIES = 80;
const MAX_ANCHOR_FILES = 6;

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function isOverviewQuestion(question) {
  const q = question.toLowerCase();
  return OVERVIEW_PATTERNS.some((re) => re.test(q));
}

/** Rank files by simple keyword overlap between the question and path/summary.
 * Also reports whether anything actually matched, so the caller can fall
 * back to overview mode instead of guessing from an empty match. */
function rankRelevantFiles(question, nodes, topN = 4) {
  const qTokens = new Set(tokenize(question));
  const scored = nodes.map((n) => {
    const haystack = tokenize(`${n.path} ${n.summary}`);
    let score = 0;
    for (const t of haystack) if (qTokens.has(t)) score += 1;
    return { node: n, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const withScore = scored.filter((s) => s.score > 0);
  return {
    files: (withScore.length > 0 ? withScore : scored).slice(0, topN).map((s) => s.node),
    anyMatch: withScore.length > 0,
  };
}

function buildOverviewContext(graph) {
  const anchors = graph.nodes.filter((n) =>
    ANCHOR_PATTERNS.some((re) => re.test(n.name))
  );
  const anchorPaths = new Set(anchors.map((a) => a.path));

  const anchorFiles = anchors.slice(0, MAX_ANCHOR_FILES).map((n) => ({
    path: n.path,
    summary: n.summary,
    content: graph.contentByPath[n.path]?.slice(0, 3000) || "",
  }));

  // Everything else contributes just its one-line summary (not full content)
  // so the model can see the shape of the whole repo without blowing the
  // token budget. Capped for very large repos.
  const summaryOnly = graph.nodes
    .filter((n) => !anchorPaths.has(n.path))
    .slice(0, MAX_OVERVIEW_SUMMARIES)
    .map((n) => ({ path: n.path, summary: n.summary, content: "" }));

  return [...anchorFiles, ...summaryOnly];
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

  const { files: keywordFiles, anyMatch } = rankRelevantFiles(question, graph.nodes, 4);
  const overview = isOverviewQuestion(question) || !anyMatch;

  const contextFiles = overview
    ? buildOverviewContext(graph)
    : keywordFiles.map((n) => ({
        path: n.path,
        summary: n.summary,
        content: graph.contentByPath[n.path]?.slice(0, 4000) || "",
      }));

  try {
    const result = await answerRepoQuestion({
      question,
      contextFiles,
      history: (history || []).slice(-6),
      maxTokens: overview ? 900 : 600,
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
