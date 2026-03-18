"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import MapGL, {
  NavigationControl,
  Marker,
  Source,
  Layer,
  MapRef,
} from "react-map-gl/mapbox";
import type { MapMouseEvent } from "react-map-gl/mapbox";
import {
  ScanArea,
  ScanStage,
  ScanProgressStep,
  AreaScanResult,
} from "@/lib/types";
import {
  createScanArea,
  boundsToGeoJSON,
  tilesToGeoJSON,
  buildProgressSteps,
  generateScanResults,
  estimateLocation,
  formatCoord,
  SCAN_STEPS,
  LocationInfo,
} from "@/lib/area-scanner-data";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// ── Color tokens ────────────────────────────────────────────────────
const C = {
  navy950: "#08111F",
  navy800: "#13243A",
  navy700: "#1c3352",
  elevated: "#182B44",
  blush: "#C7A39B",
  ice100: "#E8EEF7",
  steel400: "#8FA3BD",
  steel500: "#7a8faa",
  cyan: "#22d3ee",
  cyanDim: "rgba(34,211,238,0.15)",
};

const GROUP_COLORS: Record<string, string> = {
  containers: "#C7A39B",
  equipment: "#f59e0b",
  construction: "#10b981",
};

const GROUP_LABELS: Record<string, string> = {
  containers: "Containers",
  equipment: "Equipment",
  construction: "Construction Signals",
};

// ════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════

export default function AreaScanner() {
  const mapRef = useRef<MapRef>(null);
  const [stage, setStage] = useState<ScanStage>("idle");
  const [scanArea, setScanArea] = useState<ScanArea | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [progressSteps, setProgressSteps] = useState<ScanProgressStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [results, setResults] = useState<AreaScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<AreaScanResult | null>(null);
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [scanToolActive, setScanToolActive] = useState(false);
  const [tilesScanned, setTilesScanned] = useState(0);
  const scanAbortRef = useRef(false);

  // No mapbox token guard
  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-navy-950 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C7A39B" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-navy-950 mb-2">Mapbox Token Required</h3>
          <p className="text-sm text-steel-500">
            Add <code className="bg-ice-100 px-1.5 py-0.5 rounded text-xs font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> to
            your <code className="bg-ice-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code> file.
          </p>
        </div>
      </div>
    );
  }

  // ── Map click handler ───────────────────────────────────────────
  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!scanToolActive) return;
      if (stage === "scanning") return;

      const { lat, lng } = e.lngLat;
      const area = createScanArea(lat, lng);
      const loc = estimateLocation(lat, lng);

      setScanArea(area);
      setLocationInfo(loc);
      setStage("selected");
      setResults([]);
      setSelectedResult(null);
      setTilesScanned(0);
      setScanToolActive(false);

      // Fly to the selected area
      mapRef.current?.fitBounds(
        [
          [area.bounds.west, area.bounds.south],
          [area.bounds.east, area.bounds.north],
        ],
        { padding: 80, duration: 1200 }
      );
    },
    [scanToolActive, stage]
  );

  // ── Start scan simulation ─────────────────────────────────────
  const startScan = useCallback(async () => {
    if (!scanArea) return;
    scanAbortRef.current = false;

    setStage("scanning");
    const steps = buildProgressSteps();
    setProgressSteps(steps);
    setCurrentStepIdx(0);
    setTilesScanned(0);

    // Simulate progress through each step
    for (let i = 0; i < SCAN_STEPS.length; i++) {
      if (scanAbortRef.current) return;

      setCurrentStepIdx(i);
      setProgressSteps((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status: idx < i ? "complete" : idx === i ? "active" : "pending",
        }))
      );

      // Simulate tile scanning progress during imagery/analysis steps
      if (i >= 2 && i <= 5) {
        const tilesPerStep = Math.ceil(scanArea.tileCount / 4);
        const startTile = Math.min((i - 2) * tilesPerStep, scanArea.tileCount);
        const endTile = Math.min(startTile + tilesPerStep, scanArea.tileCount);
        for (let t = startTile; t < endTile; t++) {
          if (scanAbortRef.current) return;
          await sleep(60 + Math.random() * 80);
          setTilesScanned(t + 1);
        }
      } else {
        await sleep(800 + Math.random() * 600);
      }
    }

    // Mark all complete
    setProgressSteps((prev) => prev.map((s) => ({ ...s, status: "complete" })));
    setTilesScanned(scanArea.tileCount);

    // Generate results
    await sleep(400);
    const scanResults = generateScanResults(scanArea.bounds);
    setResults(scanResults);
    setStage("complete");
  }, [scanArea]);

  // ── Reset scan ────────────────────────────────────────────────
  const resetScan = useCallback(() => {
    scanAbortRef.current = true;
    setStage("idle");
    setScanArea(null);
    setLocationInfo(null);
    setProgressSteps([]);
    setCurrentStepIdx(-1);
    setResults([]);
    setSelectedResult(null);
    setTilesScanned(0);
    setScanToolActive(false);
    setResultFilter("all");
  }, []);

  // ── Map data sources ──────────────────────────────────────────
  const scanAreaGeoJSON = useMemo(
    () => (scanArea ? boundsToGeoJSON(scanArea.bounds) : null),
    [scanArea]
  );

  const tilesGeoJSON = useMemo(
    () => (scanArea ? tilesToGeoJSON(scanArea.bounds) : null),
    [scanArea]
  );

  // ── Filtered results ──────────────────────────────────────────
  const filteredResults = useMemo(() => {
    if (resultFilter === "all") return results;
    return results.filter((r) => r.group === resultFilter);
  }, [results, resultFilter]);

  // ── Result summary ────────────────────────────────────────────
  const resultSummary = useMemo(() => {
    const containers = results.filter((r) => r.group === "containers").length;
    const equipment = results.filter((r) => r.group === "equipment").length;
    const construction = results.filter((r) => r.group === "construction").length;
    const avgConfidence =
      results.length > 0
        ? results.reduce((s, r) => s + r.confidence, 0) / results.length
        : 0;
    return { containers, equipment, construction, total: results.length, avgConfidence };
  }, [results]);

  // ── Scan progress percentage ──────────────────────────────────
  const scanPercent = useMemo(() => {
    if (stage !== "scanning") return 0;
    if (!scanArea) return 0;
    return Math.round((tilesScanned / scanArea.tileCount) * 100);
  }, [stage, tilesScanned, scanArea]);

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden bg-navy-950">
      {/* ════════════ MAP AREA ════════════ */}
      <div className="flex-1 relative">
        {/* Top toolbar */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          {/* Scan tool button */}
          {(stage === "idle" || stage === "selected" || stage === "complete") && (
            <button
              onClick={() => {
                setScanToolActive(!scanToolActive);
                if (stage === "complete") {
                  // Allow new scan after completion
                  setResults([]);
                  setStage("idle");
                  setScanArea(null);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg backdrop-blur-sm ${
                scanToolActive
                  ? "bg-cyan-500 text-navy-950 ring-2 ring-cyan-400/50"
                  : "bg-navy-800/90 text-ice-100 hover:bg-navy-700/90 border border-navy-600/50"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
                <path d="M12 8v8M8 12h8" />
              </svg>
              {scanToolActive ? "Click Map to Scan" : "Area Scan Tool"}
            </button>
          )}

          {/* Reset button */}
          {(stage === "selected" || stage === "complete") && (
            <button
              onClick={resetScan}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-navy-800/90 text-steel-400 hover:text-ice-100 transition-all shadow-lg backdrop-blur-sm border border-navy-600/50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              Reset
            </button>
          )}
        </div>

        {/* Scan active crosshair hint */}
        {scanToolActive && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-navy-800/95 text-cyan-400 text-xs font-medium px-4 py-2 rounded-full backdrop-blur-sm border border-cyan-500/30 shadow-lg animate-pulse-slow">
              Click anywhere on the map to place a 3×3 mile scan zone
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {stage === "scanning" && (
          <div className="absolute bottom-4 left-4 z-10">
            <div className="bg-navy-800/95 backdrop-blur-sm rounded-lg px-4 py-3 border border-cyan-500/30 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400 text-sm font-medium">
                  Scanning... {scanPercent}%
                </span>
                <span className="text-steel-500 text-xs">
                  {tilesScanned}/{scanArea?.tileCount ?? 0} tiles
                </span>
              </div>
              <div className="mt-2 w-48 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${scanPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <MapGL
          ref={mapRef}
          initialViewState={{
            latitude: 33.45,
            longitude: -111.94,
            zoom: 10,
          }}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          style={{ width: "100%", height: "100%" }}
          cursor={scanToolActive ? "crosshair" : "grab"}
          onClick={handleMapClick}
        >
          <NavigationControl position="bottom-right" />

          {/* Scan area rectangle */}
          {scanAreaGeoJSON && (
            <Source
              id="scan-area"
              type="geojson"
              data={scanAreaGeoJSON as GeoJSON.Feature}
            >
              <Layer
                id="scan-area-fill"
                type="fill"
                paint={{
                  "fill-color": stage === "scanning" ? C.cyan : C.blush,
                  "fill-opacity": stage === "scanning" ? 0.08 : 0.12,
                }}
              />
              <Layer
                id="scan-area-outline"
                type="line"
                paint={{
                  "line-color": stage === "scanning" ? C.cyan : C.blush,
                  "line-width": 2,
                  "line-dasharray": [4, 2],
                }}
              />
            </Source>
          )}

          {/* Tile grid — show during scanning and complete */}
          {tilesGeoJSON && (stage === "scanning" || stage === "complete") && (
            <Source
              id="scan-tiles"
              type="geojson"
              data={tilesGeoJSON as GeoJSON.FeatureCollection}
            >
              <Layer
                id="scan-tiles-outline"
                type="line"
                paint={{
                  "line-color": stage === "scanning" ? C.cyan : C.steel400,
                  "line-width": 0.5,
                  "line-opacity": stage === "scanning" ? 0.4 : 0.2,
                }}
              />
            </Source>
          )}

          {/* Result markers */}
          {stage === "complete" &&
            filteredResults.map((r) => (
              <Marker
                key={r.id}
                latitude={r.lat}
                longitude={r.lng}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedResult(r);
                }}
              >
                <ResultPin
                  group={r.group}
                  isSelected={selectedResult?.id === r.id}
                />
              </Marker>
            ))}
        </MapGL>
      </div>

      {/* ════════════ SIDE PANEL ════════════ */}
      <div className="w-[380px] bg-[#0F1B2D] border-l border-navy-700 flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="px-5 py-4 border-b border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blush-400/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.blush} strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 3v18" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-ice-100">Area Scanner</h2>
              <p className="text-[10px] text-steel-500 uppercase tracking-wider">
                {stage === "idle" && "Select scan zone"}
                {stage === "selecting" && "Place scan area"}
                {stage === "selected" && "Ready to scan"}
                {stage === "scanning" && "Scan in progress"}
                {stage === "complete" && "Scan complete"}
              </p>
            </div>
          </div>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── IDLE STATE ── */}
          {stage === "idle" && !scanArea && (
            <div className="px-5 py-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-navy-800 flex items-center justify-center mx-auto mb-4">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.steel400} strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2" />
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-ice-100 mb-2">
                Select a Scan Area
              </h3>
              <p className="text-xs text-steel-500 leading-relaxed mb-6 max-w-[260px] mx-auto">
                Activate the scan tool above, then click anywhere on the map to
                place a 3×3 mile scan zone. The system will analyze satellite
                imagery for containers, equipment, and construction activity.
              </p>
              <div className="space-y-2 text-left max-w-[260px] mx-auto">
                <StepHint number={1} text="Click the Area Scan Tool button" />
                <StepHint number={2} text="Click on the map to place your scan zone" />
                <StepHint number={3} text='Review details, then click "Start Scan"' />
              </div>
            </div>
          )}

          {/* ── SELECTED / READY STATE ── */}
          {stage === "selected" && scanArea && (
            <div className="px-5 py-4 space-y-4">
              {/* Scan zone details */}
              <Section title="Scan Zone">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <Detail label="Center Lat" value={formatCoord(scanArea.center.lat, "lat")} />
                  <Detail label="Center Lng" value={formatCoord(scanArea.center.lng, "lng")} />
                  <Detail label="North" value={formatCoord(scanArea.bounds.north, "lat")} />
                  <Detail label="South" value={formatCoord(scanArea.bounds.south, "lat")} />
                  <Detail label="East" value={formatCoord(scanArea.bounds.east, "lng")} />
                  <Detail label="West" value={formatCoord(scanArea.bounds.west, "lng")} />
                </div>
              </Section>

              <Section title="Scan Parameters">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <Detail label="Area" value="3 × 3 miles (9 sq mi)" />
                  <Detail label="Tile Grid" value={`6 × 6 (${scanArea.tileCount} tiles)`} />
                  <Detail label="Tile Size" value="~0.5 × 0.5 miles" />
                  <Detail label="Est. Time" value={`~${scanArea.estimatedScanTime}s`} />
                </div>
              </Section>

              {locationInfo && (
                <Section title="Location Estimate">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <Detail label="City" value={locationInfo.city} />
                    <Detail label="State" value={locationInfo.state} />
                    <Detail label="County" value={locationInfo.county} />
                    <Detail label="ZIP" value={locationInfo.zip} />
                  </div>
                </Section>
              )}

              <Section title="Detection Targets">
                <div className="space-y-1.5 text-xs">
                  <TargetRow color={C.blush} label="Storage Containers" sub="40ft, other sizes" />
                  <TargetRow color="#f59e0b" label="Construction Equipment" sub="Excavators, bulldozers, cranes, trucks" />
                  <TargetRow color="#10b981" label="Construction Signals" sub="Cleared land, active sites, foundations" />
                </div>
              </Section>

              {/* Start Scan button */}
              <button
                onClick={startScan}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-blush-400 to-blush-300 text-navy-950 font-bold text-sm hover:shadow-lg hover:shadow-blush-400/20 transition-all active:scale-[0.98]"
              >
                Start Scan
              </button>
            </div>
          )}

          {/* ── SCANNING STATE ── */}
          {stage === "scanning" && (
            <div className="px-5 py-4 space-y-4">
              {/* Progress ring */}
              <div className="flex items-center justify-center py-4">
                <div className="relative">
                  <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke={C.navy700}
                      strokeWidth="6"
                    />
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke={C.cyan}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      strokeDashoffset={`${2 * Math.PI * 42 * (1 - scanPercent / 100)}`}
                      transform="rotate(-90 50 50)"
                      className="transition-all duration-300"
                    />
                    <text
                      x="50" y="46"
                      textAnchor="middle"
                      fill={C.cyan}
                      fontSize="22"
                      fontWeight="700"
                      fontFamily="system-ui"
                    >
                      {scanPercent}%
                    </text>
                    <text
                      x="50" y="62"
                      textAnchor="middle"
                      fill={C.steel500}
                      fontSize="9"
                      fontFamily="system-ui"
                    >
                      {tilesScanned}/{scanArea?.tileCount} tiles
                    </text>
                  </svg>
                </div>
              </div>

              {/* Step list */}
              <div className="space-y-1">
                {progressSteps.map((step, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                      step.status === "active"
                        ? "bg-cyan-500/10 text-cyan-400"
                        : step.status === "complete"
                          ? "text-steel-500"
                          : "text-navy-600"
                    }`}
                  >
                    {step.status === "complete" && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                    {step.status === "active" && (
                      <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    )}
                    {step.status === "pending" && (
                      <div className="w-3.5 h-3.5 rounded-full border border-navy-600" />
                    )}
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── COMPLETE STATE ── */}
          {stage === "complete" && (
            <div className="space-y-0">
              {/* Result summary cards */}
              <div className="px-5 py-4 border-b border-navy-700">
                <div className="grid grid-cols-3 gap-2">
                  <SummaryCard
                    label="Containers"
                    value={resultSummary.containers}
                    color={C.blush}
                    active={resultFilter === "containers"}
                    onClick={() => setResultFilter(resultFilter === "containers" ? "all" : "containers")}
                  />
                  <SummaryCard
                    label="Equipment"
                    value={resultSummary.equipment}
                    color="#f59e0b"
                    active={resultFilter === "equipment"}
                    onClick={() => setResultFilter(resultFilter === "equipment" ? "all" : "equipment")}
                  />
                  <SummaryCard
                    label="Construction"
                    value={resultSummary.construction}
                    color="#10b981"
                    active={resultFilter === "construction"}
                    onClick={() => setResultFilter(resultFilter === "construction" ? "all" : "construction")}
                  />
                </div>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="text-steel-500">
                    {filteredResults.length} of {results.length} detections
                  </span>
                  <span className="text-steel-500">
                    Avg confidence: {Math.round(resultSummary.avgConfidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Results list */}
              <div className="overflow-y-auto max-h-[calc(100vh-340px)]">
                {filteredResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedResult(r);
                      mapRef.current?.flyTo({
                        center: [r.lng, r.lat],
                        zoom: 16,
                        duration: 800,
                      });
                    }}
                    className={`w-full text-left px-5 py-3 border-b border-navy-700/50 hover:bg-navy-800/50 transition-colors ${
                      selectedResult?.id === r.id ? "bg-navy-800/80" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: GROUP_COLORS[r.group] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ice-100 truncate">
                            {r.label}
                          </span>
                          <span className="text-[10px] text-steel-500 ml-2 flex-shrink-0">
                            {Math.round(r.confidence * 100)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-steel-500 mt-0.5 truncate">
                          {r.address ?? `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: GROUP_COLORS[r.group] + "18",
                              color: GROUP_COLORS[r.group],
                            }}
                          >
                            {GROUP_LABELS[r.group]}
                          </span>
                          {r.opportunityScore != null && (
                            <span className="text-[9px] text-steel-500">
                              Opp: {r.opportunityScore}/100
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Actions footer */}
              <div className="px-5 py-3 border-t border-navy-700 space-y-2">
                <button
                  onClick={() => {
                    // Re-fit to scan area
                    if (scanArea) {
                      mapRef.current?.fitBounds(
                        [
                          [scanArea.bounds.west, scanArea.bounds.south],
                          [scanArea.bounds.east, scanArea.bounds.north],
                        ],
                        { padding: 80, duration: 800 }
                      );
                    }
                  }}
                  className="w-full py-2 rounded-lg bg-navy-800 text-steel-400 text-xs font-medium hover:text-ice-100 hover:bg-navy-700 transition-all border border-navy-600/50"
                >
                  Fit to Scan Area
                </button>
                <button
                  onClick={resetScan}
                  className="w-full py-2 rounded-lg bg-blush-400/10 text-blush-400 text-xs font-medium hover:bg-blush-400/20 transition-all"
                >
                  New Scan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] text-steel-500 uppercase tracking-wider font-semibold mb-2">
        {title}
      </h4>
      <div className="bg-navy-800/50 rounded-lg px-3 py-2.5 border border-navy-700/50">
        {children}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-steel-500">{label}</span>
      <p className="text-ice-100 font-medium mt-0.5">{value}</p>
    </div>
  );
}

function TargetRow({ color, label, sub }: { color: string; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <div>
        <span className="text-ice-100 font-medium">{label}</span>
        <span className="text-steel-500 ml-1.5">{sub}</span>
      </div>
    </div>
  );
}

function StepHint({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-navy-800 flex items-center justify-center text-[10px] font-bold text-steel-400 flex-shrink-0">
        {number}
      </div>
      <span className="text-xs text-steel-400">{text}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2.5 text-center transition-all border ${
        active
          ? "border-current bg-opacity-20"
          : "border-navy-700/50 bg-navy-800/50 hover:border-navy-600"
      }`}
      style={active ? { borderColor: color, backgroundColor: color + "15" } : {}}
    >
      <p className="text-lg font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-[10px] text-steel-500 mt-0.5">{label}</p>
    </button>
  );
}

function ResultPin({
  group,
  isSelected,
}: {
  group: string;
  isSelected: boolean;
}) {
  const color = GROUP_COLORS[group] ?? C.steel400;
  return (
    <div
      className={`transition-transform ${isSelected ? "scale-150" : "hover:scale-125"}`}
      style={{ cursor: "pointer" }}
    >
      <div
        className="w-3 h-3 rounded-full border-2 border-white shadow-lg"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

// ── Utility ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
