"use client";

import { Business } from "@/lib/types";

interface ConstructionIntelProps {
  businesses: Business[];
}

export default function ConstructionIntel({
  businesses,
}: ConstructionIntelProps) {
  const withConstruction = businesses
    .filter((b) => (b.constructionScore ?? 0) > 30)
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0));

  const hasData = businesses.length > 0 && businesses[0].status !== "pending";

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
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8FA3BD"
              strokeWidth="2"
            >
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy-950">
          Construction Opportunity Intelligence
        </h2>
        <p className="text-sm text-steel-500 mt-1">
          {withConstruction.length} locations with construction activity
          detected
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-navy-950 rounded-xl p-5 text-white">
          <p className="text-xs text-steel-400 mb-1">Active Construction</p>
          <p className="text-3xl font-bold">{withConstruction.length}</p>
          <p className="text-xs text-steel-500 mt-1">sites detected</p>
        </div>
        <div className="bg-navy-950 rounded-xl p-5 text-white">
          <p className="text-xs text-steel-400 mb-1">High Opportunity</p>
          <p className="text-3xl font-bold text-blush-400">
            {withConstruction.filter((b) => (b.opportunityScore ?? 0) >= 70).length}
          </p>
          <p className="text-xs text-steel-500 mt-1">score 70+</p>
        </div>
        <div className="bg-navy-950 rounded-xl p-5 text-white">
          <p className="text-xs text-steel-400 mb-1">Est. Total Demand</p>
          <p className="text-3xl font-bold">
            {withConstruction.reduce((sum, b) => {
              const match = (b.estimatedDemand ?? "").match(/(\d+)/);
              return sum + (match ? parseInt(match[1]) : 0);
            }, 0)}
            -
            {withConstruction.reduce((sum, b) => {
              const matches = (b.estimatedDemand ?? "").match(/(\d+)/g);
              return sum + (matches && matches[1] ? parseInt(matches[1]) : 0);
            }, 0)}
          </p>
          <p className="text-xs text-steel-500 mt-1">containers</p>
        </div>
      </div>

      {/* Opportunity Cards */}
      <div className="space-y-3">
        {withConstruction.map((biz) => (
          <OpportunityCard key={biz.id} business={biz} />
        ))}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-ice-200 p-4">
        <h4 className="text-xs font-semibold text-navy-950 mb-2">
          Scoring Methodology
        </h4>
        <p className="text-xs text-steel-500">
          Construction scores are derived from satellite imagery analysis
          detecting earthwork, equipment, structural changes, and material
          staging. Opportunity scores combine construction activity, existing
          container presence, and business type to estimate rental likelihood.
        </p>
      </div>
    </div>
  );
}

function OpportunityCard({ business }: { business: Business }) {
  const oppScore = business.opportunityScore ?? 0;
  const isHigh = oppScore >= 70;
  const isMedium = oppScore >= 40 && oppScore < 70;

  return (
    <div className="bg-white rounded-xl border border-ice-200 p-5 hover:border-blush-400 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
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

        {/* Score Circle */}
        <div className="flex-shrink-0 ml-4">
          <ScoreCircle value={oppScore} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4">
        <MetricBlock
          label="Construction Phase"
          value={business.constructionPhase ?? "N/A"}
        />
        <MetricBlock
          label="Construction Score"
          value={`${business.constructionScore}/100`}
        />
        <MetricBlock
          label="Opportunity Score"
          value={`${business.opportunityScore}/100`}
          highlight
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
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#E8EEF7"
          strokeWidth="4"
        />
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
}: {
  label: string;
  value: string;
  highlight?: boolean;
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
    </div>
  );
}
