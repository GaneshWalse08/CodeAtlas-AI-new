import { Handle, Position } from "reactflow";
import { FileCode2 } from "lucide-react";
import { useStore } from "../store/useStore.js";

const RISK_COLOR = {
  low: "#3ECF8E",
  medium: "#F5B942",
  high: "#F0553F",
};

export default function FileNode({ data }) {
  const { node, heatmapOn, dimmed } = data;
  const selectFile = useStore((s) => s.selectFile);
  const selectedPath = useStore((s) => s.selectedPath);
  const isSelected = selectedPath === node.path;

  const riskColor =
    heatmapOn && node.risk ? RISK_COLOR[node.risk.bucket] : "#242B38";
  const hasDependency = node.risk && !node.risk.hasTests;

  return (
    <div
      onClick={() => selectFile(node.path)}
      className="nodrag cursor-pointer"
      style={{
        width: 180,
        height: 40,
        opacity: dimmed ? 0.35 : 1,
      }}
      title={node.path}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <div
        className="flex items-center gap-2 h-full px-2.5 rounded-btn bg-surface transition-colors"
        style={{
          border: `1.5px solid ${riskColor}`,
          boxShadow: isSelected ? "0 0 0 2px #5B8CFF" : "none",
        }}
      >
        <FileCode2 size={14} className="text-text-secondary shrink-0" />
        <span className="font-mono text-xs text-text-primary truncate">
          {node.name}
        </span>
        {heatmapOn && node.risk?.bucket === "high" && (
          <span
            className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: RISK_COLOR.high }}
          />
        )}
      </div>
      <Handle type="source" position={Position.Right} style={handleStyle} />
    </div>
  );
}

const handleStyle = { background: "#4B5262", width: 6, height: 6, border: "none" };
