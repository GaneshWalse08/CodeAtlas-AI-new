import { Handle, Position } from "reactflow";
import { Folder, FolderOpen, ChevronRight } from "lucide-react";
import { useStore } from "../store/useStore.js";

export default function FolderGroupNode({ data }) {
  const { folder, count, collapsed } = data;
  const toggleFolder = useStore((s) => s.toggleFolder);
  const label = folder === "/" ? "(root)" : folder;

  if (collapsed) {
    return (
      <div
        className="nodrag cursor-pointer flex items-center gap-2 h-full px-4 rounded-card bg-surface-elevated border border-border hover:border-accent transition-colors"
        onClick={() => toggleFolder(folder)}
      >
        <Handle type="target" position={Position.Left} style={handleStyle} />
        <Folder size={16} className="text-accent shrink-0" />
        <div className="min-w-0">
          <div className="font-mono text-xs text-text-primary truncate">{label}</div>
          <div className="text-[11px] text-text-secondary">{count} files</div>
        </div>
        <ChevronRight size={14} className="ml-auto text-text-secondary shrink-0" />
        <Handle type="source" position={Position.Right} style={handleStyle} />
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-card bg-surface-elevated border border-border relative">
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <button
        onClick={() => toggleFolder(folder)}
        className="nodrag absolute top-2 left-3 flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        <FolderOpen size={13} className="text-accent" />
        <span className="font-mono">{label}</span>
        <span className="text-text-disabled">({count})</span>
      </button>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}

const handleStyle = { background: "#4B5262", width: 6, height: 6, border: "none" };
