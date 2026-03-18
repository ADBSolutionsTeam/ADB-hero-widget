"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import MapGL, {
  NavigationControl,
  Marker,
  Popup,
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
  getResultDetail,
  SCAN_STEPS,
  LocationInfo,
} from "@/lib/area-scanner-data";
import {
  generateAreaScanReport,
  generateAreaScanCSV,
} from "@/lib/area-scan-report";

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

          {/* Corner markers for scan zone */}
          {scanArea && (stage === "selected" || stage === "scanning" || stage === "complete") && (
            <>
              {[
                { lat: scanArea.bounds.north, lng: scanArea.bounds.west, corner: "tl" },
                { lat: scanArea.bounds.north, lng: scanArea.bounds.east, corner: "tr" },
                { lat: scanArea.bounds.south, lng: scanArea.bounds.west, corner: "bl" },
                { lat: scanArea.bounds.south, lng: scanArea.bounds.east, corner: "br" },
              ].map((c) => (
                <Marker key={c.corner} latitude={c.lat} longitude={c.lng} anchor="center">
                  <CornerBracket
                    corner={c.corner as "tl" | "tr" | "bl" | "br"}
                    scanning={stage === "scanning"}
                  />
                </Marker>
              ))}
            </>
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
                  mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 16, duration: 800 });
                }}
              >
                <ResultPin
                  group={r.group}
                  isSelected={selectedResult?.id === r.id}
                />
              </Marker>
            ))}

          {/* Map popup for selected result */}
          {stage === "complete" && selectedResult && (
            <Popup
              latitude={selectedResult.lat}
              longitude={selectedResult.lng}
              anchor="bottom"
              offset={12}
              closeOnClick={false}
              onClose={() => setSelectedResult(null)}
              className="area-scan-popup"
            >
              <MapResultPopup result={selectedResult} />
            </Popup>
          )}
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
            <div className="space-y-0 flex flex-col h-full">
              {/* Result summary cards */}
              <div className="px-5 py-4 border-b border-navy-700 flex-shrink-0">
                <div className="grid grid-cols-3 gap-2">
                  <SummaryCard
                    label="Containers"
                    value={resultSummary.containers}
                    color={C.blush}
                    active={resultFilter === "containers"}
                    onClick={() => { setResultFilter(resultFilter === "containers" ? "all" : "containers"); setSelectedResult(null); }}
                  />
                  <SummaryCard
                    label="Equipment"
                    value={resultSummary.equipment}
                    color="#f59e0b"
                    active={resultFilter === "equipment"}
                    onClick={() => { setResultFilter(resultFilter === "equipment" ? "all" : "equipment"); setSelectedResult(null); }}
                  />
                  <SummaryCard
                    label="Construction"
                    value={resultSummary.construction}
                    color="#10b981"
                    active={resultFilter === "construction"}
                    onClick={() => { setResultFilter(resultFilter === "construction" ? "all" : "construction"); setSelectedResult(null); }}
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

              {/* Results list OR detail panel */}
              {selectedResult ? (
                <ResultDetailPanel
                  result={selectedResult}
                  allResults={results}
                  onBack={() => setSelectedResult(null)}
                  onSelectResult={(r) => {
                    setSelectedResult(r);
                    mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 16, duration: 800 });
                  }}
                />
              ) : (
                <div className="overflow-y-auto flex-1">
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
                      className="w-full text-left px-5 py-3 border-b border-navy-700/50 hover:bg-navy-800/50 transition-colors"
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
              )}

              {/* Actions footer — only show when NOT in detail view */}
              {!selectedResult && (
                <div className="px-5 py-3 border-t border-navy-700 space-y-2 flex-shrink-0">
                  {/* Export buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        if (!scanArea) return;
                        const doc = generateAreaScanReport(scanArea, results, locationInfo);
                        const locName = locationInfo ? `${locationInfo.city}-${locationInfo.state}` : "scan";
                        doc.save(`area-scan-${locName}-${new Date().toISOString().split("T")[0]}.pdf`);
                      }}
                      className="py-2 rounded-lg bg-blush-400/10 text-blush-400 text-xs font-medium hover:bg-blush-400/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
                        <path d="M12 11v6M9 14l3 3 3-3" />
                      </svg>
                      PDF Report
                    </button>
                    <button
                      onClick={() => {
                        if (!scanArea) return;
                        const csv = generateAreaScanCSV(scanArea, results, locationInfo);
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        const locName = locationInfo ? `${locationInfo.city}-${locationInfo.state}` : "scan";
                        a.href = url;
                        a.download = `area-scan-${locName}-${new Date().toISOString().split("T")[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="py-2 rounded-lg bg-navy-800 text-steel-400 text-xs font-medium hover:text-ice-100 hover:bg-navy-700 transition-all border border-navy-600/50 flex items-center justify-center gap-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <path d="M7 10l5 5 5-5" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      CSV Export
                    </button>
                  </div>
                  <button
                    onClick={() => {
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
              )}
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

function CornerBracket({ corner, scanning }: { corner: "tl" | "tr" | "bl" | "br"; scanning: boolean }) {
  const color = scanning ? C.cyan : C.blush;
  const size = 16;
  const stroke = 2.5;

  // Determine which edges to draw based on corner position
  const paths: Record<string, string> = {
    tl: `M${stroke} ${size} L${stroke} ${stroke} L${size} ${stroke}`,
    tr: `M${size - stroke} ${size} L${size - stroke} ${stroke} L0 ${stroke}`,
    bl: `M${stroke} 0 L${stroke} ${size - stroke} L${size} ${size - stroke}`,
    br: `M${size - stroke} 0 L${size - stroke} ${size - stroke} L0 ${size - stroke}`,
  };

  return (
    <div className={scanning ? "animate-pulse-slow" : ""}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path
          d={paths[corner]}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function MapResultPopup({ result }: { result: AreaScanResult }) {
  const detail = useMemo(() => getResultDetail(result), [result]);
  const color = GROUP_COLORS[result.group] ?? C.steel400;
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <div className="min-w-[200px] p-0.5">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <h4 className="font-bold text-sm text-navy-950 leading-tight">{result.label}</h4>
      </div>
      <p className="text-[11px] text-steel-500 mb-2">
        {result.address}
      </p>

      {/* Confidence bar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 bg-ice-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${confidencePct}%`,
              backgroundColor: confidencePct > 85 ? "#10b981" : confidencePct > 70 ? "#f59e0b" : "#8FA3BD",
            }}
          />
        </div>
        <span className="text-[10px] font-bold text-navy-950">{confidencePct}%</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
          style={{ backgroundColor: color + "20", color }}
        >
          {GROUP_LABELS[result.group]}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-ice-100 text-steel-600">
          {detail.condition}
        </span>
        {result.opportunityScore != null && (
          <span className="text-[9px] text-steel-500 font-medium">
            Opp: {result.opportunityScore}/100
          </span>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Result Detail Panel
// ════════════════════════════════════════════════════════════════════

function ResultDetailPanel({
  result,
  allResults,
  onBack,
  onSelectResult,
}: {
  result: AreaScanResult;
  allResults: AreaScanResult[];
  onBack: () => void;
  onSelectResult: (r: AreaScanResult) => void;
}) {
  const detail = useMemo(() => getResultDetail(result), [result]);
  const groupColor = GROUP_COLORS[result.group] ?? C.steel400;

  // Find nearby results (same cluster / within ~0.003 degrees)
  const nearby = useMemo(() => {
    return allResults.filter(
      (r) =>
        r.id !== result.id &&
        Math.abs(r.lat - result.lat) < 0.003 &&
        Math.abs(r.lng - result.lng) < 0.004
    ).slice(0, 4);
  }, [result, allResults]);

  const confidencePct = Math.round(result.confidence * 100);

  const PRIORITY_STYLES = {
    high: { bg: "bg-red-500/15", text: "text-red-400", label: "High Priority" },
    medium: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Medium Priority" },
    low: { bg: "bg-steel-400/15", text: "text-steel-400", label: "Low Priority" },
  };
  const prio = PRIORITY_STYLES[detail.priority];

  return (
    <div className="flex flex-col flex-1 overflow-hidden animate-slide-in">
      {/* Back button */}
      <div className="px-4 py-2.5 border-b border-navy-700/50 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-steel-400 hover:text-ice-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to results
        </button>
      </div>

      {/* Scrollable detail content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Header with category icon placeholder */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: groupColor + "20" }}
          >
            <CategoryIcon category={result.category} color={groupColor} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-ice-100">{result.label}</h3>
            <p className="text-[10px] text-steel-500 mt-0.5">{result.address}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: groupColor + "18", color: groupColor }}
              >
                {GROUP_LABELS[result.group]}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${prio.bg} ${prio.text}`}>
                {prio.label}
              </span>
            </div>
          </div>
        </div>

        {/* Mock satellite crop */}
        <div className="rounded-lg overflow-hidden border border-navy-700/50">
          <div
            className="h-32 relative flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, #1a2a1a 0%, #2a3a2a 30%, #1d2d1d 60%, #253525 100%)`,
            }}
          >
            {/* Simulated satellite texture */}
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23556655' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
            {/* Detection highlight box */}
            <div
              className="relative w-16 h-10 border-2 rounded-sm"
              style={{ borderColor: groupColor, boxShadow: `0 0 12px ${groupColor}40` }}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold whitespace-nowrap px-1.5 py-0.5 rounded"
                style={{ backgroundColor: groupColor, color: C.navy950 }}>
                DETECTION
              </div>
            </div>
            {/* Tile / coords overlay */}
            <div className="absolute bottom-1.5 left-2 text-[9px] text-white/50 font-mono">
              {result.tileId} · {result.lat.toFixed(5)}, {result.lng.toFixed(5)}
            </div>
            <div className="absolute top-1.5 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: groupColor + "30", color: groupColor }}>
              Satellite View
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-steel-500 uppercase tracking-wider font-semibold">Confidence</span>
            <span className="text-xs font-bold" style={{ color: confidencePct > 85 ? "#10b981" : confidencePct > 70 ? "#f59e0b" : C.steel400 }}>
              {confidencePct}%
            </span>
          </div>
          <div className="h-2 bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${confidencePct}%`,
                backgroundColor: confidencePct > 85 ? "#10b981" : confidencePct > 70 ? "#f59e0b" : C.steel400,
              }}
            />
          </div>
        </div>

        {/* Details grid */}
        <Section title="Detection Details">
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-steel-500">Condition</span>
              <span className="font-medium" style={{ color: detail.conditionColor }}>{detail.condition}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-steel-500">Estimated Size</span>
              <span className="text-ice-100 font-medium">{detail.estimatedSize}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-steel-500">Category</span>
              <span className="text-ice-100 font-medium capitalize">{result.category.replace(/-/g, " ")}</span>
            </div>
            {result.opportunityScore != null && (
              <div className="flex items-center justify-between">
                <span className="text-steel-500">Opportunity Score</span>
                <span className="font-bold" style={{ color: C.blush }}>{result.opportunityScore}/100</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-steel-500">Source Tile</span>
              <span className="text-ice-100 font-mono text-[10px]">{result.tileId}</span>
            </div>
          </div>
        </Section>

        {/* AI Notes */}
        <Section title="Analysis Notes">
          <p className="text-xs text-steel-400 leading-relaxed">{detail.notes}</p>
        </Section>

        {/* Recommended action */}
        <div>
          <h4 className="text-[10px] text-steel-500 uppercase tracking-wider font-semibold mb-2">
            Recommended Action
          </h4>
          <div className="bg-blush-400/8 border border-blush-400/20 rounded-lg px-3 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.blush} strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
              <span className="text-xs font-bold text-blush-400">{detail.actionLabel}</span>
            </div>
            <p className="text-[11px] text-steel-400 leading-relaxed">{detail.actionDescription}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {detail.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] px-2 py-1 rounded-full bg-navy-800 text-steel-400 border border-navy-700/50 font-medium"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Nearby detections */}
        {nearby.length > 0 && (
          <div>
            <h4 className="text-[10px] text-steel-500 uppercase tracking-wider font-semibold mb-2">
              Nearby Detections ({nearby.length})
            </h4>
            <div className="space-y-1">
              {nearby.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onSelectResult(r)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-navy-800/50 hover:bg-navy-800 border border-navy-700/30 transition-colors text-left"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: GROUP_COLORS[r.group] }}
                  />
                  <span className="text-[11px] text-ice-100 font-medium truncate flex-1">{r.label}</span>
                  <span className="text-[10px] text-steel-500">{Math.round(r.confidence * 100)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail footer */}
      <div className="px-5 py-3 border-t border-navy-700 flex-shrink-0 space-y-2">
        <button
          onClick={onBack}
          className="w-full py-2 rounded-lg bg-navy-800 text-steel-400 text-xs font-medium hover:text-ice-100 hover:bg-navy-700 transition-all border border-navy-600/50"
        >
          Back to All Results
        </button>
      </div>
    </div>
  );
}

// ── Category Icons ──────────────────────────────────────────────────

function CategoryIcon({ category, color }: { category: string; color: string }) {
  // Container icon
  if (category.startsWith("container")) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="2" y="6" width="20" height="12" rx="1" />
        <line x1="7" y1="6" x2="7" y2="18" />
        <line x1="12" y1="6" x2="12" y2="18" />
        <line x1="17" y1="6" x2="17" y2="18" />
      </svg>
    );
  }
  // Equipment icons
  if (category === "excavator" || category === "bulldozer") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M3 18h2l3-8h4l2 4h7" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <path d="M12 6l-3 8" />
      </svg>
    );
  }
  if (category === "crane") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M6 21V3l12 4v2" />
        <path d="M6 7h12" />
        <path d="M18 7v6" />
        <path d="M16 13h4" />
        <circle cx="6" cy="21" r="1" />
      </svg>
    );
  }
  if (category === "dump-truck") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M3 17V7h10v10H3z" />
        <path d="M13 13h5l3 4v0H13V13z" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    );
  }
  // Construction signals
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M2 20h20" />
      <path d="M5 20V8l7-5 7 5v12" />
      <rect x="9" y="12" width="6" height="8" />
    </svg>
  );
}

// ── Utility ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
