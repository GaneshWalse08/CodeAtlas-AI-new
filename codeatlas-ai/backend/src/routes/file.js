import express from "express";
import { jobs } from "../services/cache.js";
import { explainRisk } from "../services/claude.js";

const router = express.Router();

router.get("/file", async (req, res) => {
  const { jobId, path } = req.query;
  if (!jobId || !path) {
    return res.status(400).json({ error: "Missing 'jobId' or 'path' query param." });
  }
  const job = jobs.get(jobId);
  if (!job || job.status !== "done") {
    return res.status(404).json({ error: "Analysis not found or not finished yet." });
  }
  const graph = job.result;
  const node = graph.nodes.find((n) => n.path === path);
  if (!node) return res.status(404).json({ error: "File not found in analyzed set." });

  const imports = graph.edges.filter((e) => e.source === path).map((e) => e.target);
  const importedBy = graph.edges.filter((e) => e.target === path).map((e) => e.source);

  let riskExplanation = null;
  if (node.risk) {
    try {
      riskExplanation = await explainRisk({
        path,
        changeCount: node.risk.changeCount,
        hasTests: node.risk.hasTests,
        bucket: node.risk.bucket,
      });
    } catch {
      riskExplanation = node.risk.hasTests
        ? `${node.risk.changeCount} recent changes; has test coverage.`
        : `${node.risk.changeCount} recent changes; no test file found.`;
    }
  }

  res.json({
    path: node.path,
    name: node.name,
    summary: node.summary,
    imports,
    importedBy,
    risk: node.risk ? { ...node.risk, explanation: riskExplanation } : null,
  });
});

export default router;
