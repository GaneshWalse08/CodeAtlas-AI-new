import { useEffect, useRef, useState } from "react";
import { Circle, Loader2, CheckCircle2, XCircle, GitBranch } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { subscribeToAnalysis } from "../api.js";

const STAGE_LABELS = {
  fetching: "Fetching repository files...",
  structure: "Analyzing code structure...",
  summaries: "Generating summaries...",
  risk: "Scoring risk...",
};
const STAGE_ORDER = ["fetching", "structure", "summaries", "risk"];

const ROTATING_CAPTIONS = [
  "Larger repos can take up to 30 seconds",
  "Still working — parsing dependencies",
  "Almost there — grounding the AI summaries in real file content",
];

export default function Loading() {
  const repoUrl = useStore((s) => s.repoUrl);
  const jobId = useStore((s) => s.jobId);
  const stages = useStore((s) => s.stages);
  const loadError = useStore((s) => s.loadError);
  const setStage = useStore((s) => s.setStage);
  const setLoadError = useStore((s) => s.setLoadError);
  const setGraphAndEnter = useStore((s) => s.setGraphAndEnter);
  const goToLanding = useStore((s) => s.goToLanding);

  const [captionIdx, setCaptionIdx] = useState(0);
  const unsubRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCaptionIdx((i) => (i + 1) % ROTATING_CAPTIONS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!jobId) return;
    unsubRef.current = subscribeToAnalysis(jobId, {
      onStage: (stage, status) => setStage(stage, status),
      onDone: (graph) => setGraphAndEnter(graph),
      onError: (message) => setLoadError(message),
    });
    return () => unsubRef.current?.();
  }, [jobId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[520px] flex flex-col items-center text-center gap-6">
        <div className="flex items-center gap-2 text-text-secondary">
          <GitBranch size={16} className="text-accent" />
          <span className="font-mono text-sm truncate max-w-[400px]">
            {repoUrl || "Loading repository..."}
          </span>
        </div>

        <ul className="w-full flex flex-col gap-3 text-left">
          {STAGE_ORDER.map((key) => (
            <li
              key={key}
              className="flex items-center gap-3 bg-surface border border-border rounded-card px-4 py-3"
            >
              <StageIcon status={stages[key]} />
              <span
                className={
                  stages[key] === "done"
                    ? "text-text-primary"
                    : stages[key] === "error"
                    ? "text-status-error"
                    : "text-text-secondary"
                }
              >
                {STAGE_LABELS[key]}
              </span>
            </li>
          ))}
        </ul>

        {!loadError && (
          <>
            <div className="w-full h-1 bg-border rounded-pill overflow-hidden">
              <div className="h-full w-1/3 bg-accent rounded-pill animate-[loading-slide_1.4s_ease-in-out_infinite]" />
            </div>
            <p className="text-text-secondary text-sm">{ROTATING_CAPTIONS[captionIdx]}</p>
          </>
        )}

        {loadError && (
          <div className="w-full flex flex-col items-center gap-3 bg-surface border border-status-error/30 rounded-card px-4 py-4">
            <p className="text-status-error text-sm">{loadError}</p>
            <button
              onClick={goToLanding}
              className="bg-accent hover:bg-accent-hover text-white rounded-btn px-4 py-2 text-sm font-medium transition-colors"
            >
              Try another repo
            </button>
          </div>
        )}

        <style>{`
          @keyframes loading-slide {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(150%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    </div>
  );
}

function StageIcon({ status }) {
  if (status === "done") return <CheckCircle2 size={18} className="text-risk-low shrink-0" />;
  if (status === "active") return <Loader2 size={18} className="text-accent animate-spin shrink-0" />;
  if (status === "error") return <XCircle size={18} className="text-status-error shrink-0" />;
  return <Circle size={18} className="text-text-disabled shrink-0" />;
}
