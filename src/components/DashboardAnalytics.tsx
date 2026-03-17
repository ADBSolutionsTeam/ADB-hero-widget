"use client";

import { useMemo } from "react";
import { Business } from "@/lib/types";

interface DashboardAnalyticsProps {
  businesses: Business[];
  onNavigate: (tab: string) => void;
}

export default function DashboardAnalytics({
  businesses,
  onNavigate,
}: DashboardAnalyticsProps) {
  const processed = businesses.filter(
    (b) => b.status && b.status !== "pending"
  );

  const stats = useMemo(() => {
    const confirmed = processed.filter((b) => b.status === "confirmed");
    const review = processed.filter((b) => b.status === "review");
    const clear = processed.filter((b) => b.status === "clear");

    // Confidence buckets
    const confBuckets = [
      { label: "90-100%", min: 90, max: 100, color: "bg-emerald-500" },
      { label: "70-89%", min: 70, max: 89, color: "bg-emerald-400" },
      { label: "45-69%", min: 45, max: 69, color: "bg-amber-400" },
      { label: "0-44%", min: 0, max: 44, color: "bg-slate-300" },
    ];
    const confDist = confBuckets.map((bucket) => ({
      ...bucket,
      count: processed.filter((b) => {
        const c = Math.round((b.confidence ?? 0) * 100);
        return c >= bucket.min && c <= bucket.max;
      }).length,
    }));

    // Opportunity tiers
    const oppTiers = [
      { label: "High", desc: "70-100", min: 70, color: "text-emerald-600", bg: "bg-emerald-100" },
      { label: "Medium", desc: "40-69", min: 40, color: "text-amber-600", bg: "bg-amber-100" },
      { label: "Low", desc: "0-39", min: 0, color: "text-steel-500", bg: "bg-slate-100" },
    ];
    const oppDist = oppTiers.map((tier, i) => ({
      ...tier,
      count: processed.filter((b) => {
        const o = b.opportunityScore ?? 0;
        const max = i === 0 ? 100 : oppTiers[i - 1].min - 1;
        return o >= tier.min && o <= max;
      }).length,
    }));

    // Container type breakdown
    const allDetections = processed.flatMap((b) => b.containerDetails ?? []);
    const validDetections = allDetections.filter(
      (d) => !d.excluded && d.confidence >= 0.45
    );
    const containerTypes = {
      "40ft": validDetections.filter((d) => d.type === "40ft").length,
      other: validDetections.filter((d) => d.type === "other").length,
      trailer: allDetections.filter((d) => d.type === "trailer").length,
      excluded: allDetections.filter((d) => d.excluded).length,
    };

    // Construction phases
    const phases = ["Excavation", "Foundation", "Framing", "Active Build", "Site Prep", "Renovation"];
    const phaseDist = phases
      .map((phase) => ({
        phase,
        count: processed.filter((b) => b.constructionPhase === phase).length,
      }))
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);

    // Demand forecast
    const demandLevels = ["4-8 containers", "2-4 containers", "1-2 containers", "None"];
    const demandDist = demandLevels
      .map((level) => ({
        level,
        count: processed.filter((b) => b.estimatedDemand === level).length,
      }))
      .filter((d) => d.count > 0);

    return {
      confirmed: confirmed.length,
      review: review.length,
      clear: clear.length,
      confDist,
      oppDist,
      containerTypes,
      phaseDist,
      demandDist,
      totalProcessed: processed.length,
    };
  }, [processed]);

  if (processed.length === 0) return null;

  const total = stats.totalProcessed;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-navy-950">Analytics Overview</h3>
        <span className="text-xs text-steel-400">
          Based on {total} analyzed sites
        </span>
      </div>

      {/* Row 1: Status donut + Confidence dist + Opportunity tiers */}
      <div className="grid grid-cols-3 gap-4">
        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-ice-200 p-5">
          <h4 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-4">
            Status Distribution
          </h4>
          <div className="flex items-center gap-5">
            <DonutChart
              segments={[
                { value: stats.confirmed, color: "#10b981" },
                { value: stats.review, color: "#f59e0b" },
                { value: stats.clear, color: "#94a3b8" },
              ]}
              total={total}
              centerLabel={`${total}`}
              centerSub="total"
            />
            <div className="space-y-2.5 flex-1">
              <DonutLegend
                color="bg-emerald-500"
                label="Confirmed"
                count={stats.confirmed}
                total={total}
              />
              <DonutLegend
                color="bg-amber-500"
                label="Review"
                count={stats.review}
                total={total}
              />
              <DonutLegend
                color="bg-slate-400"
                label="Clear"
                count={stats.clear}
                total={total}
              />
            </div>
          </div>
        </div>

        {/* Confidence Distribution */}
        <div className="bg-white rounded-xl border border-ice-200 p-5">
          <h4 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-4">
            Confidence Distribution
          </h4>
          <div className="space-y-3">
            {stats.confDist.map((bucket) => {
              const pct = total > 0 ? (bucket.count / total) * 100 : 0;
              return (
                <div key={bucket.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-navy-950 font-medium">
                      {bucket.label}
                    </span>
                    <span className="text-xs text-steel-400">
                      {bucket.count}{" "}
                      <span className="text-steel-300">
                        ({Math.round(pct)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-ice-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bucket.color} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Opportunity Tiers */}
        <div className="bg-white rounded-xl border border-ice-200 p-5">
          <h4 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-4">
            Opportunity Tiers
          </h4>
          <div className="space-y-3">
            {stats.oppDist.map((tier) => {
              const pct = total > 0 ? (tier.count / total) * 100 : 0;
              return (
                <div
                  key={tier.label}
                  className={`flex items-center justify-between ${tier.bg} rounded-lg px-3 py-2.5`}
                >
                  <div>
                    <span className={`text-sm font-bold ${tier.color}`}>
                      {tier.label}
                    </span>
                    <span className="text-[10px] text-steel-400 ml-1.5">
                      ({tier.desc})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${tier.color}`}>
                      {tier.count}
                    </span>
                    <span className="text-[10px] text-steel-400">
                      {Math.round(pct)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => onNavigate("construction")}
            className="mt-3 w-full text-xs text-blush-400 hover:text-navy-950 font-medium transition-colors text-center"
          >
            View Construction Intel →
          </button>
        </div>
      </div>

      {/* Row 2: Container types + Construction phases + Demand forecast */}
      <div className="grid grid-cols-3 gap-4">
        {/* Container Types */}
        <div className="bg-white rounded-xl border border-ice-200 p-5">
          <h4 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-4">
            Detection Breakdown
          </h4>
          <div className="space-y-3">
            <TypeRow
              label="40ft Containers"
              count={stats.containerTypes["40ft"]}
              color="bg-navy-950"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="1" />
                  <line x1="7" y1="6" x2="7" y2="18" />
                  <line x1="17" y1="6" x2="17" y2="18" />
                </svg>
              }
            />
            <TypeRow
              label="Other Containers"
              count={stats.containerTypes.other}
              color="bg-blush-400"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="7" width="18" height="10" rx="1" />
                  <line x1="8" y1="7" x2="8" y2="17" />
                </svg>
              }
            />
            <TypeRow
              label="Trailers (excluded)"
              count={stats.containerTypes.trailer}
              color="bg-steel-400"
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="8" width="16" height="8" rx="1" />
                  <circle cx="6" cy="18" r="2" />
                  <circle cx="14" cy="18" r="2" />
                  <path d="M17 8h3l3 4v4h-6" />
                </svg>
              }
            />
          </div>
          <div className="mt-4 pt-3 border-t border-ice-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-steel-400">Manual exclusions</span>
              <span className="text-xs font-semibold text-navy-950">
                {stats.containerTypes.excluded}
              </span>
            </div>
          </div>
        </div>

        {/* Construction Phases */}
        <div className="bg-white rounded-xl border border-ice-200 p-5">
          <h4 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-4">
            Construction Phases
          </h4>
          {stats.phaseDist.length > 0 ? (
            <div className="space-y-2.5">
              {stats.phaseDist.map((p, i) => {
                const maxCount = stats.phaseDist[0].count;
                const pct = maxCount > 0 ? (p.count / maxCount) * 100 : 0;
                const colors = [
                  "bg-navy-950",
                  "bg-blush-400",
                  "bg-emerald-500",
                  "bg-amber-400",
                  "bg-sky-400",
                  "bg-violet-400",
                ];
                return (
                  <div key={p.phase} className="flex items-center gap-3">
                    <span className="text-xs text-navy-950 font-medium w-24 truncate">
                      {p.phase}
                    </span>
                    <div className="flex-1 h-5 bg-ice-100 rounded-md overflow-hidden">
                      <div
                        className={`h-full rounded-md ${colors[i % colors.length]} transition-all duration-700 flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max(pct, 12)}%` }}
                      >
                        <span className="text-[10px] font-bold text-white">
                          {p.count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-steel-400 text-center py-4">
              No construction data available
            </p>
          )}
        </div>

        {/* Demand Forecast */}
        <div className="bg-white rounded-xl border border-ice-200 p-5">
          <h4 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-4">
            Estimated Demand
          </h4>
          {stats.demandDist.length > 0 ? (
            <div className="space-y-2">
              {stats.demandDist.map((d) => {
                const pct = total > 0 ? (d.count / total) * 100 : 0;
                const isHigh = d.level.startsWith("4");
                const isMed = d.level.startsWith("2");
                return (
                  <div
                    key={d.level}
                    className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                      isHigh
                        ? "bg-emerald-50 border border-emerald-100"
                        : isMed
                        ? "bg-amber-50 border border-amber-100"
                        : "bg-ice-100 border border-ice-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isHigh && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      )}
                      {isMed && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
                      {!isHigh && !isMed && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                      <span
                        className={`text-xs font-medium ${
                          isHigh
                            ? "text-emerald-700"
                            : isMed
                            ? "text-amber-700"
                            : "text-steel-600"
                        }`}
                      >
                        {d.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          isHigh
                            ? "text-emerald-600"
                            : isMed
                            ? "text-amber-600"
                            : "text-steel-500"
                        }`}
                      >
                        {d.count}
                      </span>
                      <span className="text-[10px] text-steel-400 w-8 text-right">
                        {Math.round(pct)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-steel-400 text-center py-4">
              No demand data available
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-ice-200 text-center">
            <span className="text-[10px] text-steel-400">
              Total estimated:{" "}
              <span className="font-semibold text-navy-950">
                {stats.demandDist.reduce((s, d) => {
                  const match = d.level.match(/(\d+)-(\d+)/);
                  if (!match) return s;
                  const avg = (parseInt(match[1]) + parseInt(match[2])) / 2;
                  return s + avg * d.count;
                }, 0).toFixed(0)}{" "}
                containers
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pure CSS Donut Chart ─────────────────────────────────────

function DonutChart({
  segments,
  total,
  centerLabel,
  centerSub,
}: {
  segments: { value: number; color: string }[];
  total: number;
  centerLabel: string;
  centerSub: string;
}) {
  const size = 90;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {segments.map((seg, i) => {
          const pct = total > 0 ? seg.value / total : 0;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const thisOffset = offset;
          offset += dash;
          if (seg.value === 0) return null;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-thisOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          );
        })}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-navy-950">{centerLabel}</span>
        <span className="text-[9px] text-steel-400">{centerSub}</span>
      </div>
    </div>
  );
}

function DonutLegend({
  color,
  label,
  count,
  total,
}: {
  color: string;
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-xs text-navy-950">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-navy-950">{count}</span>
        <span className="text-[10px] text-steel-400">{pct}%</span>
      </div>
    </div>
  );
}

function TypeRow({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white flex-shrink-0`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-xs text-navy-950 font-medium">{label}</p>
      </div>
      <span className="text-lg font-bold text-navy-950">{count}</span>
    </div>
  );
}
