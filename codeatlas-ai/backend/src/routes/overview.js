import express from "express";
import { jobs } from "../services/cache.js";
import { getReadme, getLanguages, getRecentCommits, getRawFileContent } from "../services/github.js";
import { findManifestPaths, parseManifest } from "../services/manifest.js";
import { generateProjectOverview } from "../services/claude.js";

const router = express.Router();

function groupContributors(commits) {
  const map = new Map();
  for (const c of commits) {
    const key = c.authorLogin || c.authorName;
    if (!map.has(key)) {
      map.set(key, {
        name: c.authorName,
        login: c.authorLogin,
        avatarUrl: c.avatarUrl,
        count: 0,
        mostRecentMessage: c.message,
        mostRecentDate: c.date,
      });
    }
    map.get(key).count += 1;
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

router.get("/project-overview", async (req, res) => {
  const { jobId } = req.query;
  const job = jobs.get(jobId);
  if (!job || job.status !== "done") {
    return res.status(404).json({ error: "Analysis not found or not finished yet." });
  }

  // Cache per job so re-opening the modal is instant and doesn't re-spend
  // API calls / Claude credit.
  if (job.overview) return res.json(job.overview);

  const graph = job.result;
  const { owner, repo, sha } = graph;

  try {
    const [readme, languages, commits] = await Promise.all([
      getReadme(owner, repo, sha),
      getLanguages(owner, repo),
      getRecentCommits(owner, repo, sha, 12),
    ]);

    const manifestPaths = findManifestPaths(graph.allRepoPaths || [], 4);
    const manifestContents = await Promise.all(
      manifestPaths.map((p) => getRawFileContent(owner, repo, sha, p))
    );
    const dependencies = [
      ...new Set(
        manifestPaths.flatMap((p, i) =>
          manifestContents[i] ? parseManifest(p, manifestContents[i]) : []
        )
      ),
    ];

    const fileSummaries = graph.nodes.map((n) => ({ path: n.path, summary: n.summary }));

    let ai = { summary: "Summary unavailable.", techStack: [] };
    try {
      ai = await generateProjectOverview({
        readme: readme?.content || null,
        languages,
        dependencies,
        fileSummaries,
      });
    } catch (e) {
      console.error("[project-overview] AI summary failed:", e.message);
    }

    const overview = {
      summary: ai.summary,
      techStack: ai.techStack.length > 0 ? ai.techStack : dependencies.slice(0, 10),
      languages,
      dependencies,
      readme,
      recentCommits: commits,
      contributors: groupContributors(commits),
    };

    job.overview = overview;
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
