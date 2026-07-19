import express from "express";
import { jobs } from "../services/cache.js";
import { answerRepoQuestion } from "../services/claude.js";

const router = express.Router();

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "does", "do", "this", "that", "for", "of",
  "in", "on", "to", "and", "or", "what", "where", "which", "how", "file",
  "repo", "repository", "code", "used", "use", "i", "it",
]);

// Broad, whole-repo questions still get a slightly larger token budget to
// write a fuller answer, but every question now gets the same rich context
// - see buildContext() below.
const OVERVIEW_PATTERNS = [
  /\bproject\b/, /\boverview\b/, /\bsummar/, /\bexplain\b/, /\barchitecture\b/,
  /\bpurpose\b/, /\bwhole\b/, /\bentire\b/, /\bcodebase\b/, /\bwhat (does|is) this\b/,
  /\bhow (does|is) this (built|structured|organized)\b/, /\btech stack\b/,
];

// Files whose content is almost always worth including in full, regardless
// of keyword matching.
const ANCHOR_PATTERNS = [
  /^readme/i, /^package\.json$/i, /^requirements\.txt$/i, /^pyproject\.toml$/i,
  /^(main|app|server|index|manage)\.(py|js|ts|jsx|tsx)$/i,
];
const MAX_SUMMARY_ONLY_FILES = 80;
const MAX_ANCHOR_FILES = 6;
const MAX_DEEP_FILES = 6;

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

/**
 * Ranks files by keyword overlap against BOTH the one-line AI summary AND
 * a slice of the file's actual content - not the summary alone. A short
 * AI-written summary often won't literally contain words like "login" or
 * "database" even when the real code does, so summary-only matching was
 * missing the right file for anything but very generically-worded
 * questions. Content matches count for real signal here.
 */
function rankByRelevance(question, graph, topN) {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return [];

  const scored = graph.nodes.map((n) => {
    const summaryTokens = tokenize(`${n.path} ${n.summary}`);
    const contentTokens = tokenize((graph.contentByPath[n.path] || "").slice(0, 3000));
    let score = 0;
    for (const t of summaryTokens) if (qTokens.has(t)) score += 2;
    for (const t of contentTokens) if (qTokens.has(t)) score += 1;
    return { node: n, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, topN).map((s) => s.node);
}

/**
 * Every question now gets: full content for the anchor files + the
 * best content/keyword matches, PLUS a one-line summary of every other
 * file in the repo so the model still has whole-repo awareness even when
 * keyword matching finds nothing. This replaces the old all-or-nothing
 * "overview mode vs. narrow mode" switch, which could pick 4 wrong files
 * and dead-end with "I couldn't find anything" even when the answer was
 * sitting in the repo the whole time.
 */
function buildContext(question, graph) {
  const anchors = graph.nodes.filter((n) =>
    ANCHOR_PATTERNS.some((re) => re.test(n.name))
  ).slice(0, MAX_ANCHOR_FILES);

  const targeted = rankByRelevance(question, graph, MAX_DEEP_FILES);

  const deep = [...anchors, ...targeted].filter(
    (n, i, arr) => arr.findIndex((x) => x.path === n.path) === i
  );
  const deepPaths = new Set(deep.map((n) => n.path));

  const deepFiles = deep.map((n) => ({
    path: n.path,
    summary: n.summary,
    content: graph.contentByPath[n.path]?.slice(0, 4000) || "",
  }));

  const summaryOnlyFiles = graph.nodes
    .filter((n) => !deepPaths.has(n.path))
    .slice(0, MAX_SUMMARY_ONLY_FILES)
    .map((n) => ({ path: n.path, summary: n.summary, content: "" }));

  return [...deepFiles, ...summaryOnlyFiles];
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

  const contextFiles = buildContext(question, graph);
  const broad = isOverviewQuestion(question);

  try {
    const result = await answerRepoQuestion({
      question,
      contextFiles,
      history: (history || []).slice(-6),
      maxTokens: broad ? 900 : 700,
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