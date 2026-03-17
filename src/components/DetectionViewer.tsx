"use client";

import { useState } from "react";
import { Business } from "@/lib/types";

interface DetectionViewerProps {
  business: Business;
  onBack: () => void;
}

export default function DetectionViewer({
  business,
  onBack,
}: DetectionViewerProps) {
  const [hoveredDetection, setHoveredDetection] = useState<number | null>(null);

  const validDetections = (business.containerDetails ?? []).filter(
    (d) => !d.excluded && d.confidence >= 0.45
  );
  const excludedCount = (business.containerDetails ?? []).filter(
    (d) => d.excluded
  ).length;
  const totalDetections = (business.containerDetails ?? []).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-white border border-ice-200 flex items-center justify-center hover:border-navy-800 hover:bg-ice-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <StatusBadgeLarge status={business.status ?? "pending"} />
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="Containers" value={String(business.containersDetected ?? 0)} color="text-blush-400" />
        <MiniStat label="Confidence" value={`${Math.round((business.confidence ?? 0) * 100)}%`} />
        <MiniStat label="Opportunity" value={`${business.opportunityScore ?? 0}`} color={
          (business.opportunityScore ?? 0) >= 70 ? "text-emerald-600" : undefined
        } />
        <MiniStat label="Est. Demand" value={business.estimatedDemand ?? "None"} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Satellite Image with Overlays */}
        <div className="col-span-2 bg-white rounded-xl border border-ice-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-ice-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-navy-950">
                Satellite Detection View
              </h3>
              <span className="text-[10px] bg-ice-100 text-steel-500 px-2 py-0.5 rounded">
                {totalDetections} objects detected
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-steel-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border-2 border-emerald-500 inline-block" />
                Confirmed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border-2 border-amber-500 inline-block" />
                Review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border-2 border-red-400 inline-block opacity-50" />
                Excluded
              </span>
            </div>
          </div>

          {/* Simulated satellite view */}
          <div className="relative bg-slate-800 w-full overflow-hidden" style={{ height: 440 }}>
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
              const isHovered = hoveredDetection === i;

              let borderColor = "border-emerald-500";
              let bgColor = "bg-emerald-500/10";
              let label = `${detection.type === "40ft" ? "40'" : "Container"} ${Math.round(
                detection.confidence * 100
              )}%`;

              if (isExcluded) {
                borderColor = "border-red-400/60";
                bgColor = "bg-red-500/5";
                label = `Trailer (excluded)`;
              } else if (isReview) {
                borderColor = "border-amber-500";
                bgColor = "bg-amber-500/10";
              } else if (isLow) {
                borderColor = "border-slate-500/50";
                bgColor = "bg-slate-500/5";
                label = `Low ${Math.round(detection.confidence * 100)}%`;
              }

              return (
                <div
                  key={i}
                  className={`absolute border-2 ${borderColor} ${bgColor} rounded-sm transition-all ${
                    isHovered ? "ring-2 ring-white/40 scale-105 z-10" : ""
                  } ${isExcluded ? "opacity-50" : ""}`}
                  style={{
                    left: detection.x,
                    top: detection.y,
                    width: detection.width,
                    height: detection.height,
                  }}
                  onMouseEnter={() => setHoveredDetection(i)}
                  onMouseLeave={() => setHoveredDetection(null)}
                >
                  {/* Label */}
                  <span
                    className={`absolute -top-5 left-0 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                      isExcluded
                        ? "bg-red-500/80 text-white line-through"
                        : isConfirmed
                        ? "bg-emerald-500 text-white"
                        : isReview
                        ? "bg-amber-500 text-white"
                        : "bg-slate-500 text-white"
                    }`}
                  >
                    {label}
                  </span>

                  {/* Corner markers */}
                  {!isExcluded && !isLow && (
                    <>
                      <span className={`absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2 ${borderColor.replace("border-", "border-")}`} />
                      <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2 ${borderColor.replace("border-", "border-")}`} />
                      <span className={`absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2 ${borderColor.replace("border-", "border-")}`} />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2 ${borderColor.replace("border-", "border-")}`} />
                    </>
                  )}
                </div>
              );
            })}

            {/* Scan line animation */}
            <div className="absolute left-0 right-0 h-0.5 bg-blush-400/50 animate-scan pointer-events-none" />

            {/* Overlay info bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex items-end justify-between">
              <div className="text-white text-[10px] space-y-0.5">
                <p className="font-mono opacity-70">
                  {business.lat?.toFixed(4)}°N, {Math.abs(business.lng ?? 0).toFixed(4)}°W
                </p>
                <p className="opacity-50">Zoom: 18 | Resolution: 0.3m/px</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-white/50">Imagery source: Simulated</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          {/* Detection Summary */}
          <div className="bg-white rounded-xl border border-ice-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-950 mb-3 flex items-center gap-2">
              Detection Summary
              <span className="text-[10px] bg-ice-100 text-steel-500 px-2 py-0.5 rounded">
                {validDetections.length} valid
              </span>
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
                warning={excludedCount > 0}
              />
              <DetailRow
                label="Low Confidence"
                value={String((business.containerDetails ?? []).filter(d => !d.excluded && d.confidence < 0.45).length)}
              />
            </div>
          </div>

          {/* Individual Detections */}
          <div className="bg-white rounded-xl border border-ice-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-950 mb-3">
              Detections
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(business.containerDetails ?? []).map((d, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                    hoveredDetection === i ? "ring-1 ring-navy-800" : ""
                  } ${
                    d.excluded
                      ? "bg-red-50 text-red-700"
                      : d.confidence >= 0.9
                      ? "bg-emerald-50 text-emerald-700"
                      : d.confidence >= 0.45
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-50 text-slate-500"
                  }`}
                  onMouseEnter={() => setHoveredDetection(i)}
                  onMouseLeave={() => setHoveredDetection(null)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      d.excluded
                        ? "bg-red-400"
                        : d.confidence >= 0.9
                        ? "bg-emerald-500"
                        : d.confidence >= 0.45
                        ? "bg-amber-500"
                        : "bg-slate-400"
                    }`} />
                    <span className="font-medium">
                      {d.type === "40ft"
                        ? "40' Container"
                        : d.type === "trailer"
                        ? "Trailer"
                        : "Container"}
                    </span>
                  </div>
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{Math.round(d.confidence * 100)}%</span>
                    {d.excluded && (
                      <span className="text-[10px] bg-red-200 px-1.5 py-0.5 rounded font-semibold">
                        EXCLUDED
                      </span>
                    )}
                  </span>
                </div>
              ))}
              {(business.containerDetails ?? []).length === 0 && (
                <p className="text-xs text-steel-500 text-center py-4">
                  No objects detected at this location
                </p>
              )}
            </div>
          </div>

          {/* Construction Intel */}
          {(business.constructionScore ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-ice-200 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-navy-950 mb-3">
                Opportunity Intel
              </h3>
              <div className="space-y-3">
                {business.constructionPhase && (
                  <DetailRow
                    label="Phase"
                    value={business.constructionPhase}
                  />
                )}
                <DetailRow
                  label="Construction Score"
                  value={`${business.constructionScore}/100`}
                />
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-steel-500">Opportunity Score</span>
                    <span className="text-sm font-bold text-blush-400">{business.opportunityScore}/100</span>
                  </div>
                  <div className="w-full h-2 bg-ice-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        (business.opportunityScore ?? 0) >= 70
                          ? "bg-emerald-500"
                          : (business.opportunityScore ?? 0) >= 40
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${business.opportunityScore ?? 0}%` }}
                    />
                  </div>
                </div>
                <DetailRow
                  label="Est. Demand"
                  value={business.estimatedDemand ?? "N/A"}
                  highlight
                />
              </div>
            </div>
          )}

          {/* Detection Rules */}
          <div className="bg-navy-950 rounded-xl p-4 text-white">
            <h4 className="text-xs font-semibold text-steel-400 mb-2 uppercase tracking-wider">Detection Rules</h4>
            <div className="space-y-1.5 text-[11px] text-steel-500">
              <p>Wheels detected → Trailer → Excluded</p>
              <p>Confidence &lt;0.45 → Ignored</p>
              <p>Confidence 0.45–0.90 → Review</p>
              <p>Confidence &gt;0.90 → Confirmed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-ice-200 p-3">
      <p className="text-[10px] text-steel-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold ${color ?? "text-navy-950"}`}>{value}</p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
  warning,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-steel-500">{label}</span>
      <span
        className={`text-sm font-semibold ${
          warning
            ? "text-red-500"
            : highlight
            ? "text-blush-400"
            : "text-navy-950"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadgeLarge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; dot: string }> = {
    confirmed: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
    review: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
    clear: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
    pending: { bg: "bg-slate-100", text: "text-slate-400", dot: "bg-slate-300" },
  };

  const s = styles[status] ?? styles.pending;

  return (
    <span className={`${s.bg} ${s.text} text-xs px-3 py-1.5 rounded-lg font-semibold capitalize flex items-center gap-2`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function SatelliteBackground({ seed }: { seed: string }) {
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

  // Ground base — more realistic earth tones
  const baseHue = 80 + Math.floor(rng() * 40);
  elements.push(
    <div
      key="ground"
      className="absolute inset-0"
      style={{
        background: `linear-gradient(${135 + rng() * 30}deg,
          hsl(${baseHue}, 15%, 22%) 0%,
          hsl(${baseHue + 10}, 12%, 26%) 40%,
          hsl(${baseHue - 5}, 18%, 20%) 100%)`,
      }}
    />
  );

  // Terrain variation patches
  for (let i = 0; i < 5; i++) {
    elements.push(
      <div
        key={`terrain-${i}`}
        className="absolute rounded-full"
        style={{
          left: rng() * 500,
          top: rng() * 400,
          width: 80 + rng() * 120,
          height: 60 + rng() * 100,
          backgroundColor: `hsl(${baseHue + rng() * 20}, ${8 + rng() * 10}%, ${18 + rng() * 8}%)`,
          opacity: 0.4 + rng() * 0.3,
          filter: "blur(8px)",
        }}
      />
    );
  }

  // Roads
  for (let i = 0; i < 3; i++) {
    const isHorizontal = rng() > 0.5;
    elements.push(
      <div
        key={`road-${i}`}
        className="absolute"
        style={{
          ...(isHorizontal
            ? { left: 0, right: 0, top: 60 + rng() * 320, height: 8 + rng() * 4 }
            : { top: 0, bottom: 0, left: 60 + rng() * 400, width: 8 + rng() * 4 }),
          backgroundColor: `rgba(100, 100, 100, ${0.4 + rng() * 0.3})`,
        }}
      />
    );
  }

  // Buildings / structures
  for (let i = 0; i < 8; i++) {
    const shade = 45 + Math.floor(rng() * 35);
    const w = 35 + rng() * 110;
    const h = 25 + rng() * 80;
    elements.push(
      <div
        key={`building-${i}`}
        className="absolute"
        style={{
          left: 20 + rng() * 430,
          top: 20 + rng() * 340,
          width: w,
          height: h,
          backgroundColor: `rgb(${shade}, ${shade + 3}, ${shade + 8})`,
          opacity: 0.75 + rng() * 0.25,
          boxShadow: `2px 2px 4px rgba(0,0,0,0.3)`,
        }}
      />
    );
  }

  // Parking / concrete areas
  for (let i = 0; i < 4; i++) {
    elements.push(
      <div
        key={`lot-${i}`}
        className="absolute"
        style={{
          left: 40 + rng() * 380,
          top: 40 + rng() * 320,
          width: 40 + rng() * 80,
          height: 30 + rng() * 50,
          backgroundColor: `rgb(${90 + Math.floor(rng() * 20)}, ${88 + Math.floor(rng() * 18)}, ${82 + Math.floor(rng() * 16)})`,
          opacity: 0.5 + rng() * 0.2,
        }}
      />
    );
  }

  // Vegetation patches
  for (let i = 0; i < 3; i++) {
    elements.push(
      <div
        key={`veg-${i}`}
        className="absolute rounded-full"
        style={{
          left: rng() * 480,
          top: rng() * 380,
          width: 20 + rng() * 40,
          height: 20 + rng() * 40,
          backgroundColor: `hsl(${100 + rng() * 30}, ${20 + rng() * 15}%, ${18 + rng() * 8}%)`,
          opacity: 0.6,
        }}
      />
    );
  }

  return <>{elements}</>;
}
