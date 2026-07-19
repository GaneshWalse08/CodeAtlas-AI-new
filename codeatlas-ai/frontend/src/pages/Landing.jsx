import { useEffect, useState } from "react";
import { GitBranch, ArrowRight, Github, Loader2, Linkedin } from "lucide-react";
import { useStore } from "../store/useStore.js";
import { fetchExamples, startAnalyze } from "../api.js";

const REPO_URL_RE = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/;

export default function Landing() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [examples, setExamples] = useState([]);
  const startAnalysis = useStore((s) => s.startAnalysis);
  const setJobId = useStore((s) => s.setJobId);

  useEffect(() => {
    fetchExamples().then(setExamples).catch(() => setExamples([]));
  }, []);

  async function submit(targetUrl) {
    const value = (targetUrl ?? url).trim();
    if (!REPO_URL_RE.test(value)) {
      setError("That doesn't look like a GitHub repo URL");
      return;
    }
    setError(null);
    setSubmitting(true);
    const match = value.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    const owner = match[1];
    const repo = match[2].replace(/\/$/, "");
    // Transition immediately per spec Step 2 - don't wait on the pipeline.
    startAnalysis(value, owner, repo);
    try {
      const { jobId } = await startAnalyze(value);
      setJobId(jobId);
    } catch (e) {
      useStore.getState().setLoadError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleExampleClick(exUrl) {
    setUrl(exUrl);
    submit(exUrl);
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* faint dot-grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(#5B8CFF 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <header className="relative flex items-center gap-2 px-6 py-5">
        <GitBranch size={20} className="text-accent" />
        <span className="font-semibold text-text-primary">CodeAtlas AI</span>
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[640px] flex flex-col items-center text-center gap-6 py-12">
          <h1 className="text-[40px] md:text-[48px] font-semibold leading-tight text-text-primary">
            Understand any codebase in minutes
          </h1>
          <p className="text-text-secondary text-base max-w-md">
            Paste a GitHub repo and get an interactive map, AI summaries, and
            answers to your questions.
          </p>

          <div className="w-full flex flex-col sm:flex-row gap-3 mt-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="https://github.com/owner/repo"
              className="flex-1 font-mono text-sm bg-surface border border-border rounded-btn px-4 py-3 text-text-primary placeholder:text-text-disabled focus:border-accent focus:outline-none transition-colors"
            />
            <button
              onClick={() => submit()}
              disabled={submitting || !url.trim()}
              className="shrink-0 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover disabled:bg-text-disabled disabled:cursor-not-allowed text-white font-medium rounded-btn px-5 py-3 transition-colors"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              Map it
            </button>
          </div>
          {error && (
            <p className="text-status-error text-sm -mt-3 w-full text-left">{error}</p>
          )}

          <div className="w-full flex items-center gap-3 mt-4 text-text-secondary text-xs uppercase tracking-wide">
            <span className="flex-1 h-px bg-border" />
            or try an example
            <span className="flex-1 h-px bg-border" />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {examples.map((ex) => (
              <button
                key={ex.url}
                onClick={() => handleExampleClick(ex.url)}
                className="flex items-center gap-2 border border-border rounded-btn px-4 py-2 text-sm text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <Github size={14} className="text-text-secondary" />
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-20">
  <div className="max-w-6xl mx-auto px-6 py-14">

    {/* Top Section */}
    <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr] gap-12">

      {/* Brand */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <GitBranch size={22} className="text-accent" />
          <span className="text-xl font-semibold text-text-primary">
            CodeAtlas AI
          </span>
        </div>

        <p className="text-sm leading-7 text-text-secondary max-w-md">
          Fetches a repository's file tree, extracts import relationships, and
          uses AI to generate architecture summaries and answer questions
          grounded in the actual code.
        </p>
      </div>

      {/* Project */}
      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-text-disabled mb-4">
          Project
        </h3>

        <div className="flex flex-col gap-3">
          <a
            href="https://github.com/GaneshWalse08/CodeAtlas-AI-new"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-text-secondary hover:text-accent transition-colors"
          >
            View Source
          </a>
        </div>
      </div>

      {/* Team */}
      <div>
        <h3 className="text-xs uppercase tracking-[0.2em] text-text-disabled mb-4">
          Team
        </h3>

        <div className="flex flex-col gap-3">
          <a
            href="https://www.linkedin.com/in/ganeshwalse/"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-text-secondary hover:text-accent transition-colors"
          >
            Ganesh Walse
          </a>

          <a
            href="https://www.linkedin.com/in/anagha-waghmare-8b22bb334/"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-text-secondary hover:text-accent transition-colors"
          >
            Anagha Waghmare
          </a>
        </div>
      </div>

    </div>

    {/* Divider */}
    <div className="border-t border-border my-10"></div>

    {/* Bottom */}
    <div className="flex flex-col items-center gap-5">

      <div className="flex items-center gap-4">

        <a
          href="https://github.com/GaneshWalse08/CodeAtlas-AI-new"
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          <Github size={17} />
        </a>

        <a
          href="https://www.linkedin.com/in/ganeshwalse/"
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          <Linkedin size={17} />
        </a>

        <a
          href="https://www.linkedin.com/in/anagha-waghmare-8b22bb334/"
          target="_blank"
          rel="noreferrer"
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-text-secondary hover:text-accent hover:border-accent transition-colors"
        >
          <Linkedin size={17} />
        </a>

      </div>

      <p className="text-xs text-text-disabled text-center">
        © {new Date().getFullYear()} CodeMap AI. All rights reserved.
      </p>

    </div>

  </div>
</footer>
    </div>
  );
}
