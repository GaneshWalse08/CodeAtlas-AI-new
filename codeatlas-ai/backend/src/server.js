import "dotenv/config";
import express from "express";
import cors from "cors";
import analyzeRouter from "./routes/analyze.js";
import chatRouter from "./routes/chat.js";
import fileRouter from "./routes/file.js";
import overviewRouter from "./routes/overview.js";
import sharedRouter from "./routes/shared.js";

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN.split(",") }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    hasGithubToken: Boolean(process.env.GITHUB_TOKEN),
  });
});

app.use("/api", analyzeRouter);
app.use("/api", chatRouter);
app.use("/api", fileRouter);
app.use("/api", overviewRouter);
app.use("/api", sharedRouter);

// Centralized fallback - never let an unhandled error return a raw/blank response.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error.", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`CodeAtlas AI backend listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠️  ANTHROPIC_API_KEY is not set - summaries and chat will fail.");
  }
  if (!process.env.GITHUB_TOKEN) {
    console.warn("⚠️  GITHUB_TOKEN is not set - GitHub API is limited to 60 req/hr.");
  }
});
