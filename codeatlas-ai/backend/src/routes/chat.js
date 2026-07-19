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
const MAX_DEEP_FILES = 8;
// Below this file count, just send full content for everything instead of
// guessing relevance at all - most demo-sized repos fall well under this,
// so there's no matching to get wrong.
const SMALL_REPO_THRESHOLD = 25;

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
 * Ranks files by whether the question's keywords appear anywhere in the
 * file's path/summary or its actual content - as a SUBSTRING match, not an
 * exact whole-word match. This matters a lot for real code: a route or
 * function is far more often named `loginUser`, `handleLogin`, or
 * `authLogin` than a bare standalone word "login" - exact-token matching
 * was missing all of those. Content is searched much deeper than before
 * (8000 chars) since the relevant line is often well past the imports.
 */
function rankByRelevance(question, graph, topN) {
  const qWords = tokenize(question);
  if (qWords.length === 0) return [];

  const scored = graph.nodes.map((n) => {
    const summaryHay = `${n.path} ${n.summary}`.toLowerCase();
    const contentHay = (graph.contentByPath[n.path] || "").slice(0, 8000).toLowerCase();
    let score = 0;
    for (const w of qWords) {
      if (summaryHay.includes(w)) score += 3;
      if (contentHay.includes(w)) score += 1;
    }
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
  // Small repo - just give the model everything. No ranking to get wrong.
  if (graph.nodes.length <= SMALL_REPO_THRESHOLD) {
    return graph.nodes.map((n) => ({
      path: n.path,
      summary: n.summary,
      content: graph.contentByPath[n.path]?.slice(0, 4000) || "",
    }));
  }

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

  console.log(
    `[chat] question="${question}" totalFiles=${graph.nodes.length} contextFilesSent=${contextFiles.length} smallRepoMode=${graph.nodes.length <= SMALL_REPO_THRESHOLD} filesWithContent=${contextFiles.filter((f) => f.content).length}`
  );

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