import { useState } from "react";
import { GitBranch, Github, Search, RotateCcw, Link2, Check } from "lucide-react";
import { useStore } from "../store/useStore.js";

const LEGEND = [
  { label: "Low", color: "#3ECF8E" },
  { label: "Medium", color: "#F5B942" },
  { label: "High", color: "#F0553F" },
  { label: "Unscored", color: "#4B5262" },
];

export default function TopBar({ riskFilter, setRiskFilter }) {
  const graph = useStore((s) => s.graph);
  const heatmapOn = useStore((s) => s.heatmapOn);
  const toggleHeatmap = useStore((s) => s.toggleHeatmap);
  const goToLanding = useStore((s) => s.goToLanding);
  const selectFile = useStore((s) => s.selectFile);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [linkCopied, setLinkCopied] = useState(false);

  function copyShareLink() {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("repo", `${graph.owner}/${graph.repo}`);
    navigator.clipboard?.writeText(url.toString());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  function onSearchChange(v) {
    setQuery(v);
    if (!v.trim()) return setSuggestions([]);
    const q = v.toLowerCase();
    setSuggestions(
      graph.nodes.filter((n) => n.path.toLowerCase().includes(q)).slice(0, 6)
    );
  }

  function jumpTo(node) {
    selectFile(node.path);
    setQuery("");
    setSuggestions([]);
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-surface">
      <button
        onClick={goToLanding}
        className="flex items-center gap-2 shrink-0"
        title="Return to landing"
      >
        <GitBranch size={18} className="text-accent" />
        <span className="font-semibold text-sm hidden md:inline">CodeAtlas AI</span>
      </button>

      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-sm text-text-primary truncate">
          {graph.owner}/{graph.repo}
        </span>
        <a
          href={`https://github.com/${graph.owner}/${graph.repo}`}
          target="_blank"
          rel="noreferrer"
          className="text-text-secondary hover:text-text-primary shrink-0"
        >
          <Github size={14} />
        </a>
        <span className="text-text-disabled text-xs hidden lg:inline shrink-0">
          analyzed {new Date(graph.analyzedAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="flex-1" />

      <div className="relative w-56 hidden sm:block">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Jump to file"
          className="w-full font-mono text-xs bg-bg border border-border rounded-btn pl-8 pr-3 py-2 text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none"
        />
        {suggestions.length > 0 && (
          <div className="absolute mt-1 w-full bg-surface-elevated border border-border rounded-btn shadow-modal overflow-hidden z-20">
            {suggestions.map((n) => (
              <button
                key={n.path}
                onClick={() => jumpTo(n)}
                className="w-full text-left px-3 py-2 text-xs font-mono text-text-primary hover:bg-bg truncate"
              >
                {n.path}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={toggleHeatmap}
        className={`text-xs px-3 py-1.5 rounded-pill border transition-colors ${
          heatmapOn
            ? "border-accent text-accent"
            : "border-border text-text-secondary hover:text-text-primary"
        }`}
      >
        Risk heatmap
      </button>

      {heatmapOn && (
        <div className="hidden lg:flex items-center gap-3">
          {LEGEND.map((l) => (
            <button
              key={l.label}
              onClick={() => setRiskFilter(riskFilter === l.label.toLowerCase() ? null : l.label.toLowerCase())}
              className="flex items-center gap-1.5"
              title={`Filter: ${l.label}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: l.color,
                  opacity: riskFilter && riskFilter !== l.label.toLowerCase() ? 0.3 : 1,
                }}
              />
              <span className="text-[11px] text-text-secondary">{l.label}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={copyShareLink}
        className="flex items-center gap-1.5 text-xs border border-border rounded-btn px-3 py-1.5 text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors shrink-0"
        title="Copy a link a teammate can open directly - no re-analysis needed"
      >
        {linkCopied ? (
          <>
            <Check size={12} className="text-risk-low" />
            <span className="text-risk-low">Copied</span>
          </>
        ) : (
          <>
            <Link2 size={12} />
            Copy link
          </>
        )}
      </button>

      <button
        onClick={goToLanding}
        className="flex items-center gap-1.5 text-xs border border-border rounded-btn px-3 py-1.5 text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors shrink-0"
      >
        <RotateCcw size={12} />
        New repo
      </button>
    </div>
  );
}
