import { LRUCache } from "lru-cache";

// Cache repo → parsed graph + summaries, keyed by owner/repo/sha, per spec.
export const repoCache = new LRUCache({
  max: 50,
  ttl: 1000 * 60 * 60, // 1 hour
});

// In-progress / completed analysis jobs, keyed by jobId.
export const jobs = new Map();

export function repoKey(owner, repo, sha) {
  return `${owner}/${repo}@${sha}`;
}
