import { useEffect, useState } from "react";
import {
  X, Copy, ArrowUpRight, ArrowDownRight, AlertTriangle,
  History, CalendarClock, FlaskConical, MessageCircle, Loader2,
} from "lucide-react";
import { useStore } from "../store/useStore.js";
import { fetchFileDetail } from "../api.js";

const RISK_STYLE = {
  low: { color: "#3ECF8E", label: "Low risk" },
  medium: { color: "#F5B942", label: "Medium risk" },
  high: { color: "#F0553F", label: "High risk" },
};

export default function SidePanel() {
  const selectedPath = useStore((s) => s.selectedPath);
  const jobId = useStore((s) => s.jobId);
  const selectFile = useStore((s) => s.selectFile);
  const prefillAndOpenChat = useStore((s) => s.prefillAndOpenChat);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedPath) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    fetchFileDetail(jobId, selectedPath)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedPath, jobId]);

  if (!selectedPath) return null;

  function copyPath() {
    navigator.clipboard?.writeText(selectedPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <aside className="w-[380px] shrink-0 bg-surface-elevated border-l border-border flex flex-col overflow-hidden">
      <div className="flex items-start justify-between px-4 py-4 border-b border-border">
        <div className="min-w-0">
          <h3 className="font-mono font-semibold text-sm text-text-primary truncate">
            {selectedPath.split("/").pop()}
          </h3>
        </div>
        <button
          onClick={() => selectFile(null)}
          className="text-text-secondary hover:text-text-primary shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border">
        <span className="font-mono text-xs text-text-secondary truncate">{selectedPath}</span>
        <button onClick={copyPath} className="text-text-secondary hover:text-text-primary shrink-0">
          <Copy size={12} />
        </button>
        {copied && <span className="text-[10px] text-risk-low shrink-0">copied</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6">
        {loading && (
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading file detail...
          </div>
        )}
        {error && <p className="text-status-error text-sm">{error}</p>}

        {detail && (
          <>
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                Summary
              </h4>
              <p className="text-sm text-text-primary leading-relaxed">{detail.summary}</p>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                Connections
              </h4>
              <ConnList
                icon={<ArrowUpRight size={12} />}
                label="Imports"
                items={detail.imports}
                onClick={selectFile}
              />
              <ConnList
                icon={<ArrowDownRight size={12} />}
                label="Imported by"
                items={detail.importedBy}
                onClick={selectFile}
                className="mt-3"
              />
            </section>

            {detail.risk && (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                  Risk
                </h4>
                <RiskBadge risk={detail.risk} />
                <div className="mt-3 flex flex-col gap-1.5 text-xs text-text-secondary">
                  <div className="flex items-center gap-2">
                    <History size={12} /> {detail.risk.changeCount} recent changes
                  </div>
                  <div className="flex items-center gap-2">
                    <FlaskConical size={12} />
                    {detail.risk.hasTests ? "Has a matching test file" : "No test file found"}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <div className="px-4 py-4 border-t border-border">
        <button
          onClick={() => prefillAndOpenChat(`Tell me more about ${selectedPath.split("/").pop()}`)}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-btn py-2.5 transition-colors"
        >
          <MessageCircle size={14} />
          Ask about this file
        </button>
      </div>
    </aside>
  );
}

function ConnList({ icon, label, items, onClick, className = "" }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-1.5">
        {icon} {label}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-text-disabled pl-4">None detected</p>
      ) : (
        <ul className="flex flex-col gap-1 pl-4">
          {items.map((p) => (
            <li key={p}>
              <button
                onClick={() => onClick(p)}
                className="font-mono text-xs text-accent hover:text-accent-hover truncate block text-left"
              >
                {p}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskBadge({ risk }) {
  const style = RISK_STYLE[risk.bucket];
  return (
    <div>
      <span
        className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium border"
        style={{
          backgroundColor: `${style.color}26`,
          color: style.color,
          borderColor: style.color,
        }}
      >
        <AlertTriangle size={12} />
        {style.label}
      </span>
      {risk.explanation && (
        <p className="text-xs text-text-secondary mt-2 leading-relaxed">{risk.explanation}</p>
      )}
    </div>
  );
}
