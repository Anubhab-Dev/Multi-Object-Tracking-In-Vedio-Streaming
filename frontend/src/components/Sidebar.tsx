import React from "react";
import {
  LayoutDashboard,
  Tv,
  Eye,
  BarChart2,
  Bell,
  Settings as SettingsIcon,
  Activity,
} from "lucide-react";

interface SidebarProps {
  activeNav: string;
  onNavClick: (e: React.MouseEvent, targetNav: string, cardId: string) => void;
  fps: number;
  latency: number;
}

export default function Sidebar({
  activeNav,
  onNavClick,
  fps,
  latency,
}: SidebarProps) {
  return (
    <aside className="w-60 bg-white border-r border-black/5 dark:bg-[#0d1120] dark:border-white/5 flex flex-col z-10 shrink-0 select-none">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-black/5 dark:border-white/5">
        <div className="w-9 h-9 bg-gradient-to-br from-[#4f6ef7] to-[#a855f7] rounded-lg flex items-center justify-center shadow-md shadow-[#4f6ef7]/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-bold text-sm leading-tight">MOT Vision</div>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-[#9ca3af] dark:text-[#4a5070]">
            Multi-Object Tracking
          </span>
        </div>
      </div>

      {/* Sidebar Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#9ca3af] dark:text-[#4a5070] px-3 mb-2">
          Menu
        </span>
        <a
          href="#"
          onClick={(e) => onNavClick(e, "dashboard", "")}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            activeNav === "dashboard"
              ? "bg-[#4f6ef7]/10 dark:bg-[#4f6ef7]/12 text-[#4f6ef7]"
              : "text-[#6b7280] dark:text-[#8b91b5] hover:bg-black/5 dark:hover:bg-white/4 hover:text-[#111827] dark:hover:text-white"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </a>
        <a
          href="#"
          onClick={(e) => onNavClick(e, "live", "card-monitor")}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            activeNav === "live"
              ? "bg-[#4f6ef7]/10 dark:bg-[#4f6ef7]/12 text-[#4f6ef7]"
              : "text-[#6b7280] dark:text-[#8b91b5] hover:bg-black/5 dark:hover:bg-white/4 hover:text-[#111827] dark:hover:text-white"
          }`}
        >
          <Tv className="w-4 h-4" />
          Live Stream
        </a>
        <a
          href="#"
          onClick={(e) => onNavClick(e, "tracking", "card-tracking")}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            activeNav === "tracking"
              ? "bg-[#4f6ef7]/10 dark:bg-[#4f6ef7]/12 text-[#4f6ef7]"
              : "text-[#6b7280] dark:text-[#8b91b5] hover:bg-black/5 dark:hover:bg-white/4 hover:text-[#111827] dark:hover:text-white"
          }`}
        >
          <Eye className="w-4 h-4" />
          Tracking
        </a>
        <a
          href="#"
          onClick={(e) => onNavClick(e, "analytics", "card-analytics")}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            activeNav === "analytics"
              ? "bg-[#4f6ef7]/10 dark:bg-[#4f6ef7]/12 text-[#4f6ef7]"
              : "text-[#6b7280] dark:text-[#8b91b5] hover:bg-black/5 dark:hover:bg-white/4 hover:text-[#111827] dark:hover:text-white"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Analytics
        </a>
        <a
          href="#"
          onClick={(e) => onNavClick(e, "events", "card-events")}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            activeNav === "events"
              ? "bg-[#4f6ef7]/10 dark:bg-[#4f6ef7]/12 text-[#4f6ef7]"
              : "text-[#6b7280] dark:text-[#8b91b5] hover:bg-black/5 dark:hover:bg-white/4 hover:text-[#111827] dark:hover:text-white"
          }`}
        >
          <Bell className="w-4 h-4" />
          Events
        </a>
        <a
          href="#"
          onClick={(e) => onNavClick(e, "settings", "settings-drawer")}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
            activeNav === "settings"
              ? "bg-[#4f6ef7]/10 dark:bg-[#4f6ef7]/12 text-[#4f6ef7]"
              : "text-[#6b7280] dark:text-[#8b91b5] hover:bg-black/5 dark:hover:bg-white/4 hover:text-[#111827] dark:hover:text-white"
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          Settings
        </a>
      </nav>

      {/* Sidebar Status Widget */}
      <div className="p-4 border-t border-black/5 dark:border-white/5">
        <div className="bg-black/[0.02] border border-black/5 dark:bg-white/[0.02] dark:border-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse shadow-sm shadow-[#22c55e]/50" />
            <span className="font-bold text-xs">System Status</span>
          </div>
          <div className="text-[10px] text-[#6b7280] dark:text-[#8b91b5] mb-3">
            All systems operational
          </div>
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6b7280] dark:text-[#8b91b5]">FPS</span>
              <span className="font-semibold font-mono">{fps.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b7280] dark:text-[#8b91b5]">Resolution</span>
              <span className="font-semibold font-mono">1280×720</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b7280] dark:text-[#8b91b5]">Bitrate</span>
              <span className="font-semibold font-mono">2.4 Mbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6b7280] dark:text-[#8b91b5]">Latency</span>
              <span className="font-semibold font-mono">{latency} ms</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
