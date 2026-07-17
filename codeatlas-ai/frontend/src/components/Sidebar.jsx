import { PanelLeftClose, PanelLeftOpen, Compass } from "lucide-react";
import { useStore } from "../store/useStore.js";

export default function Sidebar() {
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const openExplore = useStore((s) => s.openExplore);

  return (
    <aside
      className="shrink-0 bg-surface border-r border-border flex flex-col transition-[width] duration-150"
      style={{ width: collapsed ? 56 : 208 }}
    >
      <div className="flex flex-col gap-1 p-2 flex-1">
        <SidebarItem
          icon={Compass}
          label="Explore Project"
          collapsed={collapsed}
          onClick={openExplore}
        />
      </div>

      <div className="p-2 border-t border-border">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center gap-2 rounded-btn px-2.5 py-2 text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({ icon: Icon, label, collapsed, onClick }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className="w-full flex items-center gap-2.5 rounded-btn px-2.5 py-2.5 text-text-primary hover:bg-surface-elevated transition-colors"
    >
      <Icon size={18} className="text-accent shrink-0" />
      {!collapsed && <span className="text-sm truncate">{label}</span>}
    </button>
  );
}
