"use client";

import { useEffect, useState, useMemo } from "react";
import { Business } from "@/lib/types";
import { fetchStats, ApiStats } from "@/lib/api";
import MapGL, { Marker, NavigationControl } from "react-map-gl/mapbox";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface DashboardProps {
  businesses: Business[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ businesses, onNavigate }: DashboardProps) {
  const [liveStats, setLiveStats] = useState<ApiStats | null>(null);

  // Pull live stats from backend on mount and every 30s
  useEffect(() => {
    const load = () => fetchStats().then(setLiveStats).catch(() => null);
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Prefer live stats from API; fall back to client-side counts from prop
  const processed = businesses.filter((b) => b.status && b.status !== "pending");
  const confirmed = liveStats?.confirmed ?? businesses.filter((b) => b.status === "confirmed").length;
  const review = liveStats?.needs_review ?? businesses.filter((b) => b.status === "review").length;
  const totalContainers = businesses.reduce(
    (sum, b) => sum + (b.containersDetected ?? 0),
    0
  );
  const avgOpportunity =
    processed.length > 0
      ? Math.round(
          processed.reduce((sum, b) => sum + (b.opportunityScore ?? 0), 0) /
            processed.length
        )
      : 0;

  const hasData = processed.length > 0 || (liveStats !== null && (liveStats.confirmed + liveStats.needs_review + liveStats.rejected) > 0);

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative bg-navy-950 rounded-2xl p-8 text-white overflow-hidden">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#C7A39B 1px, transparent 1px), linear-gradient(90deg, #C7A39B 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Gradient overlay */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blush-400/5 rounded-full blur-3xl" />

        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blush-400/20 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C7A39B" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <line x1="7" y1="6" x2="7" y2="18" />
                  <line x1="17" y1="6" x2="17" y2="18" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold">Container Hunter</h1>
            </div>
            <p className="text-steel-400 text-sm max-w-lg leading-relaxed">
              AI-powered geospatial intelligence for the container rental
              industry. Detect containers, identify construction activity, and
              generate qualified leads — automatically.
            </p>
            <p className="text-blush-400 text-xs font-medium mt-2 tracking-wide">
              Find what others miss.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 bg-navy-800/80 px-3 py-1.5 rounded-full backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
              <span className="text-xs text-steel-400">System Online</span>
            </div>
            {hasData && (
              <div className="flex items-center gap-2 bg-navy-800/80 px-3 py-1.5 rounded-full backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-blush-400" />
                <span className="text-xs text-steel-400">
                  {processed.length} sites analyzed
                </span>
              </div>
            )}
          </div>
        </div>

        {!hasData && (
          <div className="relative mt-8 flex gap-4">
            <button
              onClick={() => onNavigate("scanner")}
              className="bg-blush-400 text-navy-950 px-6 py-3 rounded-lg text-sm font-semibold hover:bg-blush-300 transition-all hover:shadow-lg hover:shadow-blush-400/20"
            >
              Launch Business Scanner
            </button>
            <button
              onClick={() => onNavigate("construction")}
              className="border border-navy-600 text-steel-400 px-6 py-3 rounded-lg text-sm hover:border-blush-400 hover:text-blush-400 transition-colors"
            >
              Construction Intelligence
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Businesses Scanned"
          value={processed.length}
          total={businesses.length}
          subtitle={`of ${businesses.length} uploaded`}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          }
        />
        <StatCard
          label="Containers Detected"
          value={totalContainers}
          subtitle="across all sites"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
              <rect x="2" y="6" width="20" height="12" rx="1" />
              <line x1="7" y1="6" x2="7" y2="18" />
              <line x1="17" y1="6" x2="17" y2="18" />
            </svg>
          }
        />
        <StatCard
          label="Confirmed Leads"
          value={confirmed}
          subtitle={`${review} needs review`}
          accent
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C7A39B" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
        <StatCard
          label="Avg Opportunity Score"
          value={avgOpportunity}
          subtitle="out of 100"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
        />
      </div>

      {/* Overview Map — real satellite pins when API key is set */}
      {hasData && businesses.some((b) => b.lat && b.lng) && (
        <OverviewMap businesses={businesses} />
      )}

      {/* Quick Actions */}
      {hasData && (
        <div className="grid grid-cols-2 gap-4">
          <div
            onClick={() => onNavigate("scanner")}
            className="bg-white rounded-xl p-6 border border-ice-200 cursor-pointer hover:border-blush-400 transition-all hover:shadow-md group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-ice-100 flex items-center justify-center group-hover:bg-blush-400/10 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <h3 className="font-semibold text-navy-950 group-hover:text-blush-400 transition-colors">
                Business Scanner Results
              </h3>
            </div>
            <p className="text-sm text-steel-500 ml-11">
              View detection results, satellite imagery, and export leads
            </p>
          </div>
          <div
            onClick={() => onNavigate("construction")}
            className="bg-white rounded-xl p-6 border border-ice-200 cursor-pointer hover:border-blush-400 transition-all hover:shadow-md group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-ice-100 flex items-center justify-center group-hover:bg-blush-400/10 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
                  <path d="M2 20h20" />
                  <path d="M5 20V8l7-5 7 5v12" />
                </svg>
              </div>
              <h3 className="font-semibold text-navy-950 group-hover:text-blush-400 transition-colors">
                Construction Intelligence
              </h3>
            </div>
            <p className="text-sm text-steel-500 ml-11">
              View construction activity scores and opportunity rankings
            </p>
          </div>
        </div>
      )}

      {/* Top Leads */}
      {hasData && (
        <div className="bg-white rounded-xl border border-ice-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-ice-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-navy-950">Top Leads</h3>
              <span className="text-[10px] bg-blush-400/15 text-blush-400 px-2 py-0.5 rounded-full font-medium">
                {businesses.filter((b) => (b.containersDetected ?? 0) > 0).length} leads
              </span>
            </div>
            <button
              onClick={() => onNavigate("scanner")}
              className="text-xs text-blush-400 hover:text-navy-950 font-medium transition-colors"
            >
              View All
            </button>
          </div>
          <div className="divide-y divide-ice-200">
            {businesses
              .filter((b) => (b.containersDetected ?? 0) > 0)
              .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
              .slice(0, 5)
              .map((biz, index) => (
                <div
                  key={biz.id}
                  className="px-6 py-3.5 flex items-center justify-between hover:bg-ice-100/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-ice-100 flex items-center justify-center text-xs font-bold text-steel-500">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm text-navy-950">
                        {biz.name}
                      </p>
                      <p className="text-xs text-steel-500">
                        {biz.address}, {biz.city}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-navy-950">
                        {biz.containersDetected} detected
                      </p>
                      <p className="text-xs text-steel-500">
                        {Math.round((biz.confidence ?? 0) * 100)}% confidence
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-steel-400">Opportunity</p>
                      <p className={`text-sm font-bold ${
                        (biz.opportunityScore ?? 0) >= 70
                          ? "text-emerald-600"
                          : (biz.opportunityScore ?? 0) >= 40
                          ? "text-amber-600"
                          : "text-steel-500"
                      }`}>
                        {biz.opportunityScore}
                      </p>
                    </div>
                    <StatusBadge status={biz.status ?? "pending"} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Empty State — Pipeline Overview */}
      {!hasData && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              step: "1",
              title: "Upload Business List",
              desc: "Import a CSV of target businesses with addresses",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              ),
            },
            {
              step: "2",
              title: "AI Detection",
              desc: "Satellite imagery analyzed for containers and construction",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ),
            },
            {
              step: "3",
              title: "Export Leads",
              desc: "Download qualified leads ranked by opportunity score",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              ),
            },
          ].map((item) => (
            <div
              key={item.step}
              className="bg-white rounded-xl border border-ice-200 p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-navy-950 text-white flex items-center justify-center text-xs font-bold">
                  {item.step}
                </span>
                {item.icon}
              </div>
              <h4 className="font-semibold text-navy-950 text-sm mb-1">
                {item.title}
              </h4>
              <p className="text-xs text-steel-500 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  subtitle,
  accent,
  icon,
}: {
  label: string;
  value: number;
  total?: number;
  subtitle: string;
  accent?: boolean;
  icon: React.ReactNode;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    let start = 0;
    const duration = 600;
    const step = Math.max(1, Math.floor(value / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="bg-navy-800 rounded-xl p-5 text-white relative overflow-hidden group hover:bg-navy-700 transition-colors">
      <div className="absolute top-3 right-3 opacity-30 group-hover:opacity-50 transition-opacity">
        {icon}
      </div>
      <p className="text-xs text-steel-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${accent ? "text-blush-400" : ""}`}>
        {display}
      </p>
      <p className="text-xs text-steel-500 mt-1">{subtitle}</p>
    </div>
  );
}

// ── Overview Map ─────────────────────────────────────────────
// Interactive Mapbox satellite map with color-coded business pins.
// Falls back to a styled placeholder if no Mapbox token is set.
const STATUS_PIN_COLORS: Record<string, string> = {
  confirmed: "#10b981",
  review: "#f59e0b",
  clear: "#94a3b8",
  pending: "#22d3ee",
};

function OverviewMap({ businesses }: { businesses: Business[] }) {
  const located = businesses.filter((b) => b.lat && b.lng);

  const center = useMemo(() => {
    if (located.length === 0) return { lat: 33.45, lng: -111.94 };
    const avgLat = located.reduce((s, b) => s + b.lat!, 0) / located.length;
    const avgLng = located.reduce((s, b) => s + b.lng!, 0) / located.length;
    return { lat: avgLat, lng: avgLng };
  }, [located]);

  if (!MAPBOX_TOKEN || located.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-ice-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-ice-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-950">Overview Map</h3>
          <span className="text-xs text-steel-400">
            {!MAPBOX_TOKEN ? "Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local to enable" : "No geocoded businesses yet"}
          </span>
        </div>
        <div className="bg-slate-100 h-52 flex items-center justify-center">
          <p className="text-sm text-steel-400">Map unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-ice-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-ice-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy-950">Overview Map</h3>
        <div className="flex items-center gap-4 text-xs text-steel-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Review
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" /> Pending
          </span>
          <span className="text-steel-300">{located.length} sites plotted</span>
        </div>
      </div>
      <div style={{ height: 220 }}>
        <MapGL
          initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 10 }}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {located.map((b) => (
            <Marker key={b.id} latitude={b.lat!} longitude={b.lng!} anchor="bottom">
              <svg width="20" height="26" viewBox="0 0 20 26">
                <path
                  d="M10 0C4.477 0 0 4.477 0 10c0 7.5 10 16 10 16s10-8.5 10-16C20 4.477 15.523 0 10 0z"
                  fill={STATUS_PIN_COLORS[b.status ?? "pending"]}
                />
                <circle cx="10" cy="9" r="4" fill="white" fillOpacity="0.9" />
                <text x="10" y="12" textAnchor="middle" fill={STATUS_PIN_COLORS[b.status ?? "pending"]} fontSize="7" fontWeight="700" fontFamily="system-ui">
                  {b.containersDetected ?? 0}
                </text>
              </svg>
            </Marker>
          ))}
        </MapGL>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: "bg-emerald-100 text-emerald-700",
    review: "bg-amber-100 text-amber-700",
    clear: "bg-slate-100 text-slate-500",
    pending: "bg-slate-100 text-slate-400",
  };

  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
        styles[status] ?? styles.pending
      }`}
    >
      {status}
    </span>
  );
}
