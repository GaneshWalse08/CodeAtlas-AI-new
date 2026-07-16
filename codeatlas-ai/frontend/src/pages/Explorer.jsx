import { useState } from "react";
import { useStore } from "../store/useStore.js";
import TopBar from "../components/TopBar.jsx";
import Graph from "../components/Graph.jsx";
import SidePanel from "../components/SidePanel.jsx";
import ChatDrawer from "../components/ChatDrawer.jsx";

export default function Explorer() {
  const graph = useStore((s) => s.graph);
  const selectedPath = useStore((s) => s.selectedPath);
  const [riskFilter, setRiskFilter] = useState(null);

  if (!graph) return null;

  return (
    <div className="h-screen flex flex-col">
      <TopBar riskFilter={riskFilter} setRiskFilter={setRiskFilter} />

      {graph.truncated && (
        <div className="px-4 py-1.5 bg-status-warning/10 border-b border-status-warning/30 text-status-warning text-xs text-center">
          This repo was too large to fully analyze — showing the first 300 source files.
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        <Graph riskFilter={riskFilter} />
        {selectedPath && <SidePanel />}
      </div>

      <ChatDrawer />
    </div>
  );
}
