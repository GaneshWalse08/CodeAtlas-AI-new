import { useEffect } from "react";
import {
  X, Loader2, History, Users, BookOpen, Sparkles, ExternalLink,
} from "lucide-react";
import { useStore } from "../store/useStore.js";
import { fetchProjectOverview } from "../api.js";
import MarkdownLite from "./MarkdownLite.jsx";

function relativeDate(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ExploreProjectModal() {
  const open = useStore((s) => s.exploreOpen);
  const close = useStore((s) => s.closeExplore);
  const jobId = useStore((s) => s.jobId);
  const data = useStore((s) => s.exploreData);
  const loading = useStore((s) => s.exploreLoading);
  const error = useStore((s) => s.exploreError);
  const setLoading = useStore((s) => s.setExploreLoading);
  const setData = useStore((s) => s.setExploreData);
  const setError = useStore((s) => s.setExploreError);

  useEffect(() => {
    if (!open || data || loading) return;
    setLoading(true);
    fetchProjectOverview(jobId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [open]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={close}
    >
      <div
        className="w-full max-w-2xl max-h-[82vh] bg-surface-elevated border border-border rounded-card shadow-modal flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary">Explore Project</h2>
          </div>
          <button
            onClick={close}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-7">
          {loading && (
            <div className="flex items-center gap-2 text-text-secondary text-sm py-8 justify-center">
              <Loader2 size={16} className="animate-spin" /> Gathering project details...
            </div>
          )}

          {error && !loading && (
            <p className="text-status-error text-sm">{error}</p>
          )}

          {data && !loading && (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                  Summary
                </h3>
                <p className="text-sm text-text-primary leading-relaxed">{data.summary}</p>

                {data.techStack?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {data.techStack.map((t) => (
                      <span
                        key={t}
                        className="text-xs font-medium rounded-pill px-2.5 py-1 border border-accent text-accent bg-accent/10"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {data.languages?.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {data.languages.slice(0, 6).map((l) => (
                      <span key={l.name} className="text-xs text-text-secondary">
                        {l.name} <span className="text-text-disabled">{l.percent}%</span>
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2 flex items-center gap-1.5">
                  <BookOpen size={12} /> README
                </h3>
                {data.readme ? (
                  <div className="bg-bg border border-border rounded-card px-4 py-3 text-sm text-text-primary max-h-72 overflow-y-auto">
                    <MarkdownLite text={data.readme.content} />
                  </div>
                ) : (
                  <p className="text-xs text-text-disabled">No README found in this repo.</p>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2 flex items-center gap-1.5">
                  <History size={12} /> Recent changes
                </h3>
                {data.recentCommits?.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {data.recentCommits.map((c) => (
                      <li
                        key={c.sha}
                        className="flex items-start justify-between gap-3 text-sm border-b border-border pb-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-text-primary truncate">{c.message}</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {c.authorName} · {relativeDate(c.date)} ·{" "}
                            <span className="font-mono">{c.sha}</span>
                          </p>
                        </div>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-text-secondary hover:text-accent shrink-0 mt-0.5"
                        >
                          <ExternalLink size={13} />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-text-disabled">No recent commits found.</p>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2 flex items-center gap-1.5">
                  <Users size={12} /> Recent contributions
                </h3>
                {data.contributors?.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {data.contributors.map((c) => (
                      <li key={c.login || c.name} className="flex items-start gap-3">
                        {c.avatarUrl ? (
                          <img
                            src={c.avatarUrl}
                            alt={c.name}
                            className="w-7 h-7 rounded-full shrink-0 border border-border"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full shrink-0 bg-bg border border-border flex items-center justify-center text-[10px] text-text-secondary font-medium">
                            {initials(c.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary">
                            {c.name}{" "}
                            <span className="text-text-secondary text-xs">
                              · {c.count} commit{c.count === 1 ? "" : "s"}
                            </span>
                          </p>
                          <p className="text-xs text-text-secondary truncate">
                            {c.mostRecentMessage}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-text-disabled">No contributor data found.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
