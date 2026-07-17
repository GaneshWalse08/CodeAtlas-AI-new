import { Handle, Position } from "reactflow";
import { Folder, FolderOpen, ChevronRight, ChevronDown, GitBranch } from "lucide-react";
import { useStore } from "../store/useStore.js";

export default function FolderGroupNode({ data }) {
  const { key, label, count, collapsed, isRoot } = data;
  const toggleFolder = useStore((s) => s.toggleFolder);
  const canToggle = collapsed !== null;

  const Icon = isRoot ? GitBranch : collapsed ? Folder : FolderOpen;
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <div
      className={`nodrag w-full h-full flex items-center gap-2 px-4 rounded-card border transition-colors ${
        isRoot
          ? "bg-surface-elevated border-accent"
          : "bg-surface-elevated border-border hover:border-accent"
      } ${canToggle ? "cursor-pointer" : ""}`}
      onClick={() => canToggle && toggleFolder(key)}
      title={label}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Icon size={16} className="text-accent shrink-0" />
      <div className="min-w-0">
        <div className="font-mono text-xs text-text-primary truncate">{label}</div>
        <div className="text-[11px] text-text-secondary">
          {count} file{count === 1 ? "" : "s"}
        </div>
      </div>
      {canToggle && (
        <Chevron size={14} className="ml-auto text-text-secondary shrink-0" />
      )}
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}

const handleStyle = { background: "#4B5262", width: 6, height: 6, border: "none" };
