"use client";

import { useState, useMemo } from "react";
import { Business } from "@/lib/types";
import { exportToCSV } from "@/lib/mock-data";

interface ConstructionIntelProps {
  businesses: Business[];
}

type SortField = "opportunity" | "construction" | "name";

export default function ConstructionIntel({
  businesses,
}: ConstructionIntelProps) {
  const [sortBy, setSortBy] = useState<SortField>("opportunity");
  const [showExportToast, setShowExportToast] = useState(false);

  const hasData = businesses.length > 0 && businesses[0].status !== "pending";

  const withConstruction = useMemo(() => {
    const filtered = businesses.filter((b) => (b.constructionScore ?? 0) > 30);
    return filtered.sort((a, b) => {
      if (sortBy === "opportunity") return (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0);
      if (sortBy === "construction") return (b.constructionScore ?? 0) - (a.constructionScore ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [businesses, sortBy]);

  const highOpp = withConstruction.filter((b) => (b.opportunityScore ?? 0) >= 70);
  const medOpp = withConstruction.filter((b) => (b.opportunityScore ?? 0) >= 40 && (b.opportunityScore ?? 0) < 70);
  const lowOpp = withConstruction.filter((b) => (b.opportunityScore ?? 0) < 40);

  const handleExport = () => {
    const csv = exportToCSV(withConstruction);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().split("T")[0];
    a.download = `construction-intel-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 3000);
  };

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-navy-950">
            Construction Opportunity Intelligence
          </h2>
          <p className="text-sm text-steel-500 mt-1">
            Detect construction activity and score container rental
            opportunities
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-ice-200 p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-ice-100 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
              <path d="M2 20h20" />
              <path d="M5 20V8l7-5 7 5v12" />
              <rect x="9" y="12" width="6" height="8" />
            </svg>
          </div>
          <h3 className="font-semibold text-navy-950 mb-1">
            No Data Available
          </h3>
          <p className="text-sm text-steel-500 max-w-md mx-auto">
            Run a Business Scan first to generate construction intelligence
            data. Construction scores are computed during the satellite imagery
            analysis phase.
          </p>
        </div>
      </div>
    );
  }

  const totalDemandLow = withConstruction.reduce((sum, b) => {
    const match = (b.estimatedDemand ?? "").match(/(\d+)/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);
  const totalDemandHigh = withConstruction.reduce((sum, b) => {
    const matches = (b.estimatedDemand ?? "").match(/(\d+)/g);
    return sum + (matches && matches[1] ? parseInt(matches[1]) : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Export Toast */}
      {showExportToast && (
        <div className="fixed top-6 right-6 bg-navy-950 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 z-50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-medium">Construction intel exported</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-950">
            Construction Opportunity Intelligence
          </h2>
          <p className="text-sm text-steel-500 mt-1">
            {withConstruction.length} locations with construction activity
            detected
          </p>
        </div>
        <button
          onClick={handleExport}
          className="bg-navy-950 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-navy-800 transition-colors flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Intel
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-navy-950 rounded-xl p-5 text-white">
          <p className="text-xs text-steel-400 mb-1">Active Construction</p>
          <p className="text-3xl font-bold">{withConstruction.length}</p>
          <p className="text-xs text-steel-500 mt-1">sites detected</p>
        </div>
        <div className="bg-navy-950 rounded-xl p-5 text-white">
          <p className="text-xs text-steel-400 mb-1">High Opportunity</p>
          <p className="text-3xl font-bold text-emerald-400">{highOpp.length}</p>
          <p className="text-xs text-steel-500 mt-1">score 70+</p>
        </div>
        <div className="bg-navy-950 rounded-xl p-5 text-white">
          <p className="text-xs text-steel-400 mb-1">Medium Opportunity</p>
          <p className="text-3xl font-bold text-amber-400">{medOpp.length}</p>
          <p className="text-xs text-steel-500 mt-1">score 40-69</p>
        </div>
        <div className="bg-navy-950 rounded-xl p-5 text-white">
          <p className="text-xs text-steel-400 mb-1">Est. Total Demand</p>
          <p className="text-3xl font-bold text-blush-400">
            {totalDemandLow}-{totalDemandHigh}
          </p>
          <p className="text-xs text-steel-500 mt-1">containers</p>
        </div>
      </div>

      {/* Pipeline Distribution Bar */}
      {withConstruction.length > 0 && (
        <div className="bg-white rounded-xl border border-ice-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-navy-950">Opportunity Pipeline</h4>
            <div className="flex items-center gap-4 text-[10px] text-steel-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> High ({highOpp.length})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" /> Medium ({medOpp.length})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-300" /> Low ({lowOpp.length})</span>
            </div>
          </div>
          <div className="w-full h-3 bg-ice-200 rounded-full overflow-hidden flex">
            {highOpp.length > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(highOpp.length / withConstruction.length) * 100}%` }}
              />
            )}
            {medOpp.length > 0 && (
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${(medOpp.length / withConstruction.length) * 100}%` }}
              />
            )}
            {lowOpp.length > 0 && (
              <div
                className="h-full bg-slate-300 transition-all"
                style={{ width: `${(lowOpp.length / withConstruction.length) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-steel-500">Sort by:</span>
        {([
          { key: "opportunity" as const, label: "Opportunity Score" },
          { key: "construction" as const, label: "Construction Score" },
          { key: "name" as const, label: "Name" },
        ]).map((s) => (
          <button
            key={s.key}
            onClick={() => setSortBy(s.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sortBy === s.key
                ? "bg-navy-950 text-white"
                : "bg-white text-steel-600 border border-ice-200 hover:border-navy-800"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Opportunity Cards */}
      <div className="space-y-3">
        {withConstruction.map((biz, index) => (
          <OpportunityCard key={biz.id} business={biz} rank={index + 1} />
        ))}
      </div>

      {/* Methodology */}
      <div className="bg-white rounded-xl border border-ice-200 p-4">
        <h4 className="text-xs font-semibold text-navy-950 mb-2">
          Scoring Methodology
        </h4>
        <div className="grid grid-cols-2 gap-4 text-xs text-steel-500">
          <div>
            <p className="font-medium text-navy-800 mb-1">Construction Score</p>
            <p>Derived from satellite imagery analysis detecting earthwork, equipment, structural changes, and material staging.</p>
          </div>
          <div>
            <p className="font-medium text-navy-800 mb-1">Opportunity Score</p>
            <p>Combines construction activity, existing container presence, and business type to estimate rental likelihood and timing.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OpportunityCard({ business, rank }: { business: Business; rank: number }) {
  const oppScore = business.opportunityScore ?? 0;
  const isHigh = oppScore >= 70;
  const isMedium = oppScore >= 40 && oppScore < 70;

  return (
    <div className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
      isHigh ? "border-emerald-200 hover:border-emerald-400" : "border-ice-200 hover:border-blush-400"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            isHigh ? "bg-emerald-100 text-emerald-700" : isMedium ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
          }`}>
            {rank}
          </span>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-navy-950">{business.name}</h3>
              {isHigh && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                  HIGH OPPORTUNITY
                </span>
              )}
              {isMedium && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  MEDIUM
                </span>
              )}
            </div>
            <p className="text-sm text-steel-500">
              {business.address}, {business.city}, {business.state}
            </p>
          </div>
        </div>

        {/* Score Circle */}
        <div className="flex-shrink-0 ml-4">
          <ScoreCircle value={oppScore} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4 pl-10">
        <MetricBlock
          label="Construction Phase"
          value={business.constructionPhase ?? "N/A"}
        />
        <MetricBlock
          label="Construction Score"
          value={`${business.constructionScore}/100`}
          bar={business.constructionScore}
        />
        <MetricBlock
          label="Opportunity Score"
          value={`${business.opportunityScore}/100`}
          highlight
          bar={business.opportunityScore}
        />
        <MetricBlock
          label="Estimated Demand"
          value={business.estimatedDemand ?? "None"}
          highlight
        />
      </div>
    </div>
  );
}

function ScoreCircle({ value }: { value: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const color =
    value >= 70 ? "#10b981" : value >= 40 ? "#f59e0b" : "#94a3b8";

  return (
    <div className="relative w-16 h-16">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#E8EEF7" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-navy-950">{value}</span>
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  highlight,
  bar,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  bar?: number;
}) {
  return (
    <div>
      <p className="text-[10px] text-steel-500 uppercase tracking-wide mb-0.5">
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          highlight ? "text-blush-400" : "text-navy-950"
        }`}
      >
        {value}
      </p>
      {bar !== undefined && (
        <div className="w-full h-1 bg-ice-200 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full ${
              bar >= 70 ? "bg-emerald-500" : bar >= 40 ? "bg-amber-500" : "bg-slate-400"
            }`}
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </div>
  );
}
