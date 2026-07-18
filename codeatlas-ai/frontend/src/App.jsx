import { useEffect, useState } from "react";
import { useStore } from "./store/useStore.js";
import Landing from "./pages/Landing.jsx";
import Loading from "./pages/Loading.jsx";
import Explorer from "./pages/Explorer.jsx";
import { fetchSharedAnalysis, startAnalyze } from "./api.js";

export default function App() {
  const screen = useStore((s) => s.screen);
  const setJobId = useStore((s) => s.setJobId);
  const setGraphAndEnter = useStore((s) => s.setGraphAndEnter);
  const startAnalysis = useStore((s) => s.startAnalysis);
  const setLoadError = useStore((s) => s.setLoadError);
  const [checkingLink, setCheckingLink] = useState(true);

  // On first load, if the URL carries ?repo=owner/name (a shared link),
  // try to resolve it straight to a previously saved analysis - no
  // landing page, no re-spent AI/GitHub calls. If nobody's analyzed this
  // repo on this server yet, fall back to a normal fresh analysis instead
  // of just failing, so the link still works for whoever opens it first.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const repoParam = params.get("repo");
    if (!repoParam || !repoParam.includes("/")) {
      setCheckingLink(false);
      return;
    }
    const [owner, repo] = repoParam.split("/");

    fetchSharedAnalysis(owner, repo)
      .then(({ jobId, graph }) => {
        setJobId(jobId);
        setGraphAndEnter(graph);
      })
      .catch(() => {
        const url = `https://github.com/${owner}/${repo}`;
        startAnalysis(url, owner, repo);
        startAnalyze(url)
          .then(({ jobId }) => setJobId(jobId))
          .catch((e) => setLoadError(e.message));
      })
      .finally(() => setCheckingLink(false));
  }, []);

  if (checkingLink) {
    // Avoid flashing the landing page while we check for a shared link.
    return <div className="min-h-screen bg-bg" />;
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {screen === "landing" && <Landing />}
      {screen === "loading" && <Loading />}
      {screen === "explorer" && <Explorer />}
    </div>
  );
}
