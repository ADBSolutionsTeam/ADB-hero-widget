"use client";

import { Business } from "@/lib/types";

interface DetectionViewerProps {
  business: Business;
  onBack: () => void;
}

export default function DetectionViewer({
  business,
  onBack,
}: DetectionViewerProps) {
  const validDetections = (business.containerDetails ?? []).filter(
    (d) => d.confidence >= 0.45
  );
  const excludedCount = (business.containerDetails ?? []).filter(
    (d) => d.excluded
  ).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg bg-white border border-ice-200 flex items-center justify-center hover:border-navy-800 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold text-navy-950">{business.name}</h2>
          <p className="text-sm text-steel-500">
            {business.address}, {business.city}, {business.state} {business.zip}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Satellite Image with Overlays */}
        <div className="col-span-2 bg-white rounded-xl border border-ice-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-ice-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-navy-950">
              Satellite Detection View
            </h3>
            <div className="flex items-center gap-3 text-xs text-steel-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-emerald-500 inline-block" />{" "}
                Container
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-amber-500 inline-block" />{" "}
                Review
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-red-400 inline-block" style={{ textDecoration: "line-through" }} />{" "}
                Excluded
              </span>
            </div>
          </div>

          {/* Simulated satellite view with detection boxes */}
          <div className="relative bg-slate-800 w-full" style={{ height: 420 }}>
            {/* Simulated satellite base */}
            <SatelliteBackground seed={business.name} />

            {/* Detection Overlays */}
            {(business.containerDetails ?? []).map((detection, i) => {
              const isExcluded = detection.excluded;
              const isConfirmed = !isExcluded && detection.confidence >= 0.9;
              const isReview =
                !isExcluded &&
                detection.confidence >= 0.45 &&
                detection.confidence < 0.9;
              const isLow = !isExcluded && detection.confidence < 0.45;

              let borderColor = "border-emerald-500";
              let bgColor = "bg-emerald-500/10";
              let label = `${detection.type === "40ft" ? "40'" : "Container"} ${Math.round(
                detection.confidence * 100
              )}%`;

              if (isExcluded) {
                borderColor = "border-red-400";
                bgColor = "bg-red-500/10";
                label = `Trailer (excluded)`;
              } else if (isReview) {
                borderColor = "border-amber-500";
                bgColor = "bg-amber-500/10";
              } else if (isLow) {
                borderColor = "border-slate-500";
                bgColor = "bg-slate-500/10";
                label = `Low conf ${Math.round(detection.confidence * 100)}%`;
              }

              return (
                <div
                  key={i}
                  className={`absolute border-2 ${borderColor} ${bgColor} rounded-sm`}
                  style={{
                    left: detection.x,
                    top: detection.y,
                    width: detection.width,
                    height: detection.height,
                  }}
                >
                  <span
                    className={`absolute -top-5 left-0 text-[10px] font-bold px-1 rounded ${
                      isExcluded
                        ? "bg-red-500 text-white line-through"
                        : isConfirmed
                        ? "bg-emerald-500 text-white"
                        : isReview
                        ? "bg-amber-500 text-white"
                        : "bg-slate-500 text-white"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}

            {/* Scan line animation */}
            <div className="absolute left-0 right-0 h-0.5 bg-blush-400/60 animate-scan pointer-events-none" />
          </div>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          {/* Detection Summary */}
          <div className="bg-white rounded-xl border border-ice-200 p-4">
            <h3 className="text-sm font-semibold text-navy-950 mb-3">
              Detection Summary
            </h3>
            <div className="space-y-3">
              <DetailRow
                label="Containers Found"
                value={String(business.containersDetected ?? 0)}
                highlight
              />
              <DetailRow
                label="Avg Confidence"
                value={`${Math.round((business.confidence ?? 0) * 100)}%`}
              />
              <DetailRow
                label="Trailers Excluded"
                value={String(excludedCount)}
              />
              <DetailRow
                label="Status"
                value={business.status ?? "pending"}
                badge
              />
            </div>
          </div>

          {/* Individual Detections */}
          <div className="bg-white rounded-xl border border-ice-200 p-4">
            <h3 className="text-sm font-semibold text-navy-950 mb-3">
              Detections
            </h3>
            <div className="space-y-2">
              {(business.containerDetails ?? []).map((d, i) => (
                <div
                  key={i}
                  className={`p-2 rounded-lg text-xs flex items-center justify-between ${
                    d.excluded
                      ? "bg-red-50 text-red-700"
                      : d.confidence >= 0.9
                      ? "bg-emerald-50 text-emerald-700"
                      : d.confidence >= 0.45
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-50 text-slate-500"
                  }`}
                >
                  <span className="font-medium">
                    {d.type === "40ft"
                      ? "40' Container"
                      : d.type === "trailer"
                      ? "Trailer"
                      : "Container"}
                  </span>
                  <span className="flex items-center gap-2">
                    <span>{Math.round(d.confidence * 100)}%</span>
                    {d.excluded && (
                      <span className="text-[10px] bg-red-200 px-1.5 py-0.5 rounded">
                        EXCLUDED
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {(business.containerDetails ?? []).length === 0 && (
                <p className="text-xs text-steel-500">
                  No objects detected at this location
                </p>
              )}
            </div>
          </div>

          {/* Construction Intel */}
          {(business.constructionScore ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-ice-200 p-4">
              <h3 className="text-sm font-semibold text-navy-950 mb-3">
                Opportunity Intel
              </h3>
              <div className="space-y-3">
                <DetailRow
                  label="Construction Score"
                  value={`${business.constructionScore}/100`}
                />
                <DetailRow
                  label="Opportunity Score"
                  value={`${business.opportunityScore}/100`}
                  highlight
                />
                <DetailRow
                  label="Est. Demand"
                  value={business.estimatedDemand ?? "N/A"}
                />
                {business.constructionPhase && (
                  <DetailRow
                    label="Phase"
                    value={business.constructionPhase}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  badge,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-steel-500">{label}</span>
      {badge ? (
        <StatusBadge status={value} />
      ) : (
        <span
          className={`text-sm font-semibold ${
            highlight ? "text-blush-400" : "text-navy-950"
          }`}
        >
          {value}
        </span>
      )}
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

function SatelliteBackground({ seed }: { seed: string }) {
  // Generate a deterministic "satellite view" using colored rectangles
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const rng = () => {
    hash = (hash * 16807) % 2147483647;
    return (hash & 0x7fffffff) / 0x7fffffff;
  };

  const elements = [];

  // Ground base
  elements.push(
    <div
      key="ground"
      className="absolute inset-0"
      style={{
        background: `linear-gradient(135deg, #3a4a3a ${rng() * 20}%, #4a5a4a ${50 + rng() * 20}%, #3a4a3a)`,
      }}
    />
  );

  // Roads
  for (let i = 0; i < 3; i++) {
    const isHorizontal = rng() > 0.5;
    elements.push(
      <div
        key={`road-${i}`}
        className="absolute bg-gray-500/60"
        style={
          isHorizontal
            ? {
                left: 0,
                right: 0,
                top: 50 + rng() * 320,
                height: 8 + rng() * 6,
              }
            : {
                top: 0,
                bottom: 0,
                left: 50 + rng() * 400,
                width: 8 + rng() * 6,
              }
        }
      />
    );
  }

  // Buildings / structures
  for (let i = 0; i < 6; i++) {
    const shade = 50 + Math.floor(rng() * 30);
    elements.push(
      <div
        key={`building-${i}`}
        className="absolute rounded-sm"
        style={{
          left: 30 + rng() * 400,
          top: 30 + rng() * 300,
          width: 40 + rng() * 100,
          height: 30 + rng() * 80,
          backgroundColor: `rgb(${shade}, ${shade + 5}, ${shade + 10})`,
          opacity: 0.7 + rng() * 0.3,
        }}
      />
    );
  }

  // Parking lots / open areas
  for (let i = 0; i < 3; i++) {
    elements.push(
      <div
        key={`lot-${i}`}
        className="absolute rounded-sm"
        style={{
          left: 60 + rng() * 350,
          top: 60 + rng() * 280,
          width: 50 + rng() * 80,
          height: 40 + rng() * 60,
          backgroundColor: `rgb(${100 + Math.floor(rng() * 20)}, ${95 + Math.floor(rng() * 20)}, ${85 + Math.floor(rng() * 20)})`,
          opacity: 0.6,
        }}
      />
    );
  }

  return <>{elements}</>;
}
