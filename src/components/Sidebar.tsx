"use client";

import { useState } from "react";
import { Business } from "@/lib/types";

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  businesses: Business[];
}

export default function Sidebar({ activeTab, onTabChange, businesses }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Compute badge counts from business data
  const hasData = businesses.length > 0;
  const totalScanned = businesses.filter((b) => b.status && b.status !== "pending").length;
  const containersFound = businesses.reduce((s, b) => s + (b.containersDetected ?? 0), 0);
  const reviewCount = businesses.filter((b) => b.status === "review").length;
  const confirmedCount = businesses.filter((b) => b.status === "confirmed").length;
  const mapPins = businesses.filter((b) => b.lat && b.lng).length;
  const highOpportunity = businesses.filter((b) => (b.opportunityScore ?? 0) >= 70).length;

  const NAV_ITEMS = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: DashboardIcon,
      badge: hasData ? totalScanned : null,
      badgeColor: "bg-steel-500",
      hasData: hasData,
    },
    {
      id: "scanner",
      label: "Business Scanner",
      icon: ScannerIcon,
      badge: reviewCount > 0 ? reviewCount : null,
      badgeColor: "bg-amber-500",
      badgeLabel: "needs review",
      hasData: totalScanned > 0,
    },
    {
      id: "map",
      label: "Map View",
      icon: MapIcon,
      badge: mapPins > 0 ? mapPins : null,
      badgeColor: "bg-blue-500",
      hasData: mapPins > 0,
    },
    {
      id: "construction",
      label: "Construction Intel",
      icon: ConstructionIcon,
      badge: highOpportunity > 0 ? highOpportunity : null,
      badgeColor: "bg-emerald-500",
      badgeLabel: "high opportunity",
      hasData: highOpportunity > 0,
    },
    {
      id: "area-scanner",
      label: "Area Scanner",
      icon: AreaScanIcon,
      badge: null,
      badgeColor: "bg-cyan-500",
      hasData: false,
    },
  ];

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
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group relative ${
                isActive
                  ? "bg-navy-700 text-white"
                  : "text-steel-400 hover:text-white hover:bg-navy-800"
              }`}
            >
              <div className="relative flex-shrink-0">
                <Icon active={isActive} />
                {/* Data presence dot — collapsed mode */}
                {collapsed && item.hasData && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blush-400" />
                )}
              </div>

              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>

                  {/* Badge count */}
                  {item.badge !== null && (
                    <span
                      className={`${item.badgeColor} text-white text-[10px] font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {/* Data presence indicator — no badge but has data */}
                  {item.badge === null && item.hasData && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blush-400/60" />
                  )}
                </>
              )}

              {/* Collapsed badge */}
              {collapsed && item.badge !== null && (
                <span
                  className={`absolute -top-1 -right-1 ${item.badgeColor} text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center`}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}

              {/* Collapsed tooltip */}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 bg-navy-700 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                  {item.label}
                  {item.badge !== null && (
                    <span className="ml-1.5 text-blush-400">({item.badge})</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Stats — expanded only */}
      {!collapsed && hasData && (
        <div className="px-4 py-3 border-t border-navy-700 space-y-2">
          <p className="text-[10px] text-steel-500 uppercase tracking-wider font-semibold">
            Quick Stats
          </p>
          <div className="grid grid-cols-2 gap-2">
            <QuickStat label="Scanned" value={totalScanned} />
            <QuickStat label="Containers" value={containersFound} color="text-blush-400" />
            <QuickStat label="Confirmed" value={confirmedCount} color="text-emerald-400" />
            <QuickStat label="Review" value={reviewCount} color="text-amber-400" />
          </div>
        </div>
      )}

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

function QuickStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <p className="text-[10px] text-steel-500">{label}</p>
      <p className={`text-sm font-bold ${color ?? "text-white"}`}>{value}</p>
    </div>
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

function MapIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#C7A39B" : "currentColor"} strokeWidth="2">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
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

function AreaScanIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#C7A39B" : "currentColor"} strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  );
}
