import fetch from "node-fetch";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

/**
 * Claude sometimes wraps JSON in markdown fences or adds a short preamble
 * despite being told not to. This pulls out the first well-formed JSON
 * array/object it can find instead of requiring an exact match.
 */
function extractJson(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to bracket-scanning below
  }
  const firstArray = trimmed.indexOf("[");
  const lastArray = trimmed.lastIndexOf("]");
  if (firstArray !== -1 && lastArray > firstArray) {
    try {
      return JSON.parse(trimmed.slice(firstArray, lastArray + 1));
    } catch {
      // fall through
    }
  }
  const firstObj = trimmed.indexOf("{");
  const lastObj = trimmed.lastIndexOf("}");
  if (firstObj !== -1 && lastObj > firstObj) {
    try {
      return JSON.parse(trimmed.slice(firstObj, lastObj + 1));
    } catch {
      // fall through
    }
  }
  throw new Error("Could not find valid JSON in Claude's response.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callClaude({ system, messages, maxTokens = 1024 }, retriesLeft = 3) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on the backend. Add it to backend/.env."
    );
  }
  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  // 529 = Anthropic's servers are temporarily overloaded, 429 = rate limited.
  // Both are transient - worth a short wait and a retry rather than failing
  // the whole summary/chat immediately.
  if ((res.status === 529 || res.status === 429) && retriesLeft > 0) {
    const waitMs = (4 - retriesLeft) * 800; // 800ms, then 1600ms, then 2400ms
    console.warn(
      `[callClaude] got ${res.status}, retrying in ${waitMs}ms (${retriesLeft} retries left)...`
    );
    await sleep(waitMs);
    return callClaude({ system, messages, maxTokens }, retriesLeft - 1);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

const SUMMARY_SYSTEM = `You are summarizing a source code file for a developer seeing this codebase for the first time. Given the file path and its contents, write 1-2 plain-English sentences describing what this file does and its role in the project. Be specific and concrete, not generic. Do not include code syntax in the summary.`;

/**
 * Batch multiple small files into one Claude call to save latency/cost, per spec.
 * Returns a Map of path -> summary.
 */
export async function summarizeFilesBatch(files) {
  // files: [{ path, content }]
  const prompt = files
    .map(
      (f, i) =>
        `### File ${i + 1}: ${f.path}\n\`\`\`\n${f.content.slice(0, 3000)}\n\`\`\``
    )
    .join("\n\n");

  const system = `${SUMMARY_SYSTEM}\n\nYou will be given several files at once. Respond ONLY with a JSON array of objects, one per file, in the same order, like:\n[{"path": "<file path>", "summary": "<1-2 sentence summary>"}]\nReturn nothing else — no markdown fences, no preamble.`;

  const text = await callClaude({
    system,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 350 * files.length + 200,
  });

  let parsed;
  try {
    parsed = extractJson(text);
  } catch (err) {
    // Log the real cause to the backend terminal instead of hiding it -
    // this is what you should paste back if summaries keep failing.
    console.error("[summarizeFilesBatch] failed to parse Claude's response:");
    console.error("  files:", files.map((f) => f.path).join(", "));
    console.error("  raw response:", text.slice(0, 1500));
    return new Map(files.map((f) => [f.path, "Summary unavailable."]));
  }
  if (!Array.isArray(parsed)) parsed = [parsed];
  const map = new Map();
  for (const item of parsed) {
    if (item && item.path) map.set(item.path, item.summary || "Summary unavailable.");
  }
  for (const f of files) {
    if (!map.has(f.path)) map.set(f.path, "Summary unavailable.");
  }
  return map;
}

const CHAT_SYSTEM = `You answer questions about a specific GitHub repository using only the file summaries and contents provided to you below. Always name the specific file(s) your answer is grounded in. If the provided context does not contain enough information to answer confidently, say so directly instead of guessing. Keep answers concise - 2-4 sentences unless the user asks for more detail.

Respond ONLY with a JSON object of the form:
{"answer": "<your answer text>", "sources": ["<file path>", ...]}
The "sources" array must only contain paths from the context you were given, and only ones you actually used. Return nothing else.`;

export async function answerRepoQuestion({ question, contextFiles, history }) {
  const context = contextFiles
    .map(
      (f) =>
        `### ${f.path}\nSummary: ${f.summary}\n${
          f.content ? `Content:\n\`\`\`\n${f.content.slice(0, 4000)}\n\`\`\`` : ""
        }`
    )
    .join("\n\n");

  const messages = [
    ...(history || []),
    {
      role: "user",
      content: `Repository context:\n\n${context}\n\nQuestion: ${question}`,
    },
  ];

  const text = await callClaude({
    system: CHAT_SYSTEM,
    messages,
    maxTokens: 600,
  });

  try {
    const parsed = extractJson(text);
    return {
      answer: parsed.answer || "I couldn't find anything in this repo about that.",
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
    };
  } catch {
    // Claude replied with plain text instead of JSON - still show the answer,
    // just without source chips, rather than losing the response entirely.
    return { answer: text, sources: [] };
  }
}

const RISK_EXPLANATION_SYSTEM = `Given a file's change frequency, whether it has tests, and its risk bucket (low/medium/high), write ONE short sentence (under 20 words) explaining why it landed in that bucket. Be concrete, e.g. "Changed 23 times in the last 3 months, no test file found." Respond with just the sentence, nothing else.`;

export async function explainRisk({ path, changeCount, hasTests, bucket }) {
  try {
    const text = await callClaude({
      system: RISK_EXPLANATION_SYSTEM,
      messages: [
        {
          role: "user",
          content: `File: ${path}\nChange count (recent): ${changeCount}\nHas tests: ${hasTests}\nRisk bucket: ${bucket}`,
        },
      ],
      maxTokens: 60,
    });
    return text;
  } catch {
    return hasTests
      ? `${changeCount} recent changes; has test coverage.`
      : `${changeCount} recent changes; no test file found.`;
  }
}

const CONTRIBUTION_SYSTEM = `You are reviewing a developer's attempted fix for a described issue in a specific file. Given the original file content, the issue description, and the user's submitted code, assess whether it resolves the issue. Respond ONLY with a JSON object: {"verdict": "Correct" | "Partially correct" | "Needs work", "feedback": "<2-4 sentences of specific, actionable feedback referencing their actual code>"}`;

export async function reviewContribution({ issue, fileContent, userCode }) {
  const text = await callClaude({
    system: CONTRIBUTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Issue: ${issue.title}\n${issue.description}\n\nOriginal file (${issue.file}):\n\`\`\`\n${fileContent.slice(
          0,
          4000
        )}\n\`\`\`\n\nUser's submitted fix:\n\`\`\`\n${userCode}\n\`\`\``,
      },
    ],
    maxTokens: 400,
  });
  try {
    return extractJson(text);
  } catch {
    return { verdict: "Needs work", feedback: text };
  }
}
