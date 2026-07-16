import { useMemo } from "react";
import ReactFlow, { Background, Controls, MiniMap } from "reactflow";
import "reactflow/dist/style.css";
import { useStore } from "../store/useStore.js";
import { buildGraphElements } from "./graphLayout.js";
import FileNode from "./FileNode.jsx";
import FolderGroupNode from "./FolderGroupNode.jsx";

const nodeTypes = { fileNode: FileNode, folderGroup: FolderGroupNode };

export default function Graph({ riskFilter }) {
  const graph = useStore((s) => s.graph);
  const collapsedFolders = useStore((s) => s.collapsedFolders);
  const heatmapOn = useStore((s) => s.heatmapOn);
  const selectFile = useStore((s) => s.selectFile);

  const { nodes, edges } = useMemo(
    () => buildGraphElements(graph, { collapsedFolders, heatmapOn, riskFilter }),
    [graph, collapsedFolders, heatmapOn, riskFilter]
  );

  if (!graph.nodes.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-6">
        <div className="max-w-sm">
          <p className="text-text-primary font-medium mb-1">No source files detected</p>
          <p className="text-text-secondary text-sm">
            This repo may be docs-only, or everything in it was filtered out
            (binaries, lockfiles, or files over 100KB). Try another repo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onPaneClick={() => selectFile(null)}
        proOptions={{ hideAttribution: true }}
        minZoom={0.15}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="#242B38" gap={24} size={1} style={{ background: "#0B0E14" }} />
        <Controls
          className="!bg-surface !border !border-border !shadow-none [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-text-primary"
          position="bottom-right"
        />
        <MiniMap
          position="bottom-left"
          maskColor="rgba(11,14,20,0.7)"
          nodeColor={(n) => (n.type === "folderGroup" ? "#1A1F2B" : "#12161F")}
          style={{ background: "#0B0E14", border: "1px solid #242B38" }}
        />
      </ReactFlow>
    </div>
  );
}
