const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function fetchExamples() {
  const res = await fetch(`${API_BASE}/examples`);
  if (!res.ok) throw new Error("Failed to load example repos.");
  return res.json();
}

export async function startAnalyze(url) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to start analysis.");
  }
  return res.json(); // { jobId }
}

/**
 * Subscribe to SSE progress for a job.
 * handlers: { onStage(stage,status,extra), onCaption(text), onDone(graph), onError(message) }
 * Returns an unsubscribe function.
 */
export function subscribeToAnalysis(jobId, handlers) {
  const es = new EventSource(`${API_BASE}/analyze/${jobId}/stream`);

  es.onmessage = (evt) => {
    try {
      const payload = JSON.parse(evt.data);
      if (payload.type === "stage") {
        handlers.onStage?.(payload.stage, payload.status, payload);
      } else if (payload.type === "caption") {
        handlers.onCaption?.(payload.caption);
      } else if (payload.type === "done") {
        handlers.onDone?.(payload.graph);
        es.close();
      } else if (payload.type === "error") {
        handlers.onError?.(payload.message);
        es.close();
      }
    } catch {
      // ignore malformed event
    }
  };

  es.onerror = () => {
    handlers.onError?.("Lost connection to the analysis stream.");
    es.close();
  };

  return () => es.close();
}

export async function fetchFileDetail(jobId, path) {
  const res = await fetch(
    `${API_BASE}/file?jobId=${encodeURIComponent(jobId)}&path=${encodeURIComponent(path)}`
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load file detail.");
  }
  return res.json();
}

export async function fetchProjectOverview(jobId) {
  const res = await fetch(`${API_BASE}/project-overview?jobId=${encodeURIComponent(jobId)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load project overview.");
  }
  return res.json();
}

export async function askChat(jobId, question, history) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, question, history }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to get an answer.");
  }
  return res.json(); // { answer, sources }
}
