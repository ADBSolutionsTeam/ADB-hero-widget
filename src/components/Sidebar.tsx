"use client";

import { useState } from "react";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { id: "scanner", label: "Business Scanner", icon: ScannerIcon },
  { id: "construction", label: "Construction Intel", icon: ConstructionIcon },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`bg-navy-950 text-white flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-navy-700 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blush-400 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#08111F" strokeWidth="2.5">
            <rect x="2" y="6" width="20" height="12" rx="1" />
            <line x1="7" y1="6" x2="7" y2="18" />
            <line x1="17" y1="6" x2="17" y2="18" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-bold text-sm tracking-wide">CONTAINER HUNTER</h1>
            <p className="text-[10px] text-steel-400 tracking-widest uppercase">
              by ADB Solutions
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-steel-400 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {collapsed ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-navy-700 text-white"
                  : "text-steel-400 hover:text-white hover:bg-navy-800"
              }`}
            >
              <Icon active={isActive} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-navy-700">
          <p className="text-[10px] text-steel-500 uppercase tracking-wider">
            Demo Build v0.1
          </p>
        </div>
      )}
    </aside>
  );
}

function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#C7A39B" : "currentColor"} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ScannerIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#C7A39B" : "currentColor"} strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function ConstructionIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#C7A39B" : "currentColor"} strokeWidth="2">
      <path d="M2 20h20" />
      <path d="M5 20V8l7-5 7 5v12" />
      <rect x="9" y="12" width="6" height="8" />
    </svg>
  );
}
