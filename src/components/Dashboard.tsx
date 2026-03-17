"use client";

import { Business } from "@/lib/types";

interface DashboardProps {
  businesses: Business[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ businesses, onNavigate }: DashboardProps) {
  const processed = businesses.filter((b) => b.status && b.status !== "pending");
  const confirmed = businesses.filter((b) => b.status === "confirmed");
  const review = businesses.filter((b) => b.status === "review");
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

  const hasData = processed.length > 0;

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-navy-950 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Container Hunter</h1>
            <p className="text-steel-400 text-sm max-w-lg">
              AI-powered geospatial intelligence for the container rental
              industry. Find what others miss.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-navy-800 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span className="text-xs text-steel-400">System Online</span>
          </div>
        </div>

        {!hasData && (
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => onNavigate("scanner")}
              className="bg-blush-400 text-navy-950 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blush-300 transition-colors"
            >
              Launch Business Scanner
            </button>
            <button
              onClick={() => onNavigate("construction")}
              className="border border-navy-600 text-steel-400 px-5 py-2.5 rounded-lg text-sm hover:border-blush-400 hover:text-blush-400 transition-colors"
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
          subtitle={`of ${businesses.length} uploaded`}
          color="bg-navy-800"
        />
        <StatCard
          label="Containers Detected"
          value={totalContainers}
          subtitle="across all sites"
          color="bg-navy-800"
        />
        <StatCard
          label="Confirmed Leads"
          value={confirmed.length}
          subtitle={`${review.length} needs review`}
          color="bg-navy-800"
          accent
        />
        <StatCard
          label="Avg Opportunity Score"
          value={avgOpportunity}
          subtitle="out of 100"
          color="bg-navy-800"
        />
      </div>

      {/* Quick Actions */}
      {hasData && (
        <div className="grid grid-cols-2 gap-4">
          <div
            onClick={() => onNavigate("scanner")}
            className="bg-white rounded-xl p-6 border border-ice-200 cursor-pointer hover:border-blush-400 transition-colors group"
          >
            <h3 className="font-semibold text-navy-950 mb-1 group-hover:text-blush-400 transition-colors">
              Business Scanner Results
            </h3>
            <p className="text-sm text-steel-500">
              View detection results, satellite imagery, and export leads
            </p>
          </div>
          <div
            onClick={() => onNavigate("construction")}
            className="bg-white rounded-xl p-6 border border-ice-200 cursor-pointer hover:border-blush-400 transition-colors group"
          >
            <h3 className="font-semibold text-navy-950 mb-1 group-hover:text-blush-400 transition-colors">
              Construction Intelligence
            </h3>
            <p className="text-sm text-steel-500">
              View construction activity scores and opportunity rankings
            </p>
          </div>
        </div>
      )}

      {/* Top Leads */}
      {hasData && (
        <div className="bg-white rounded-xl border border-ice-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-ice-200">
            <h3 className="font-semibold text-navy-950">Top Leads</h3>
          </div>
          <div className="divide-y divide-ice-200">
            {businesses
              .filter((b) => (b.containersDetected ?? 0) > 0)
              .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
              .slice(0, 5)
              .map((biz) => (
                <div
                  key={biz.id}
                  className="px-6 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm text-navy-950">
                      {biz.name}
                    </p>
                    <p className="text-xs text-steel-500">
                      {biz.address}, {biz.city}
                    </p>
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
                    <StatusBadge status={biz.status ?? "pending"} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  color,
  accent,
}: {
  label: string;
  value: number;
  subtitle: string;
  color: string;
  accent?: boolean;
}) {
  return (
    <div className={`${color} rounded-xl p-5 text-white`}>
      <p className="text-xs text-steel-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? "text-blush-400" : ""}`}>
        {value}
      </p>
      <p className="text-xs text-steel-500 mt-1">{subtitle}</p>
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
      className={`text-xs px-2.5 py-1 rounded-full font-medium ${
        styles[status] ?? styles.pending
      }`}
    >
      {status}
    </span>
  );
}
