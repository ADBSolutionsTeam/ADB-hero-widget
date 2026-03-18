"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { Business, ProcessingStage } from "@/lib/types";
import { processBusinesses, SAMPLE_BUSINESSES } from "@/lib/mock-data";
import { uploadCSV, startScan, pollUntilDone, fetchLocations, batchReview, PipelineStatus } from "@/lib/api";
import DetectionViewer from "./DetectionViewer";
import ExportMenu from "./ExportMenu";
import FilterBar, { FilterState } from "./FilterBar";

interface BusinessScannerProps {
  businesses: Business[];
  setBusinesses: (businesses: Business[]) => void;
  filters: FilterState;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  isFiltered: boolean;
  counts: Record<string, number>;
  filteredBusinesses: Business[];
}

const STAGE_LABELS: Record<ProcessingStage, string> = {
  idle: "",
  uploading: "Parsing CSV data...",
  geocoding: "Geocoding addresses...",
  "fetching-imagery": "Fetching satellite imagery...",
  detecting: "Running AI container detection...",
  complete: "Analysis complete",
};

const STAGE_ORDER: ProcessingStage[] = [
  "uploading",
  "geocoding",
  "fetching-imagery",
  "detecting",
  "complete",
];

export default function BusinessScanner({
  businesses,
  setBusinesses,
  filters,
  updateFilter,
  resetFilters,
  isFiltered,
  counts,
  filteredBusinesses,
}: BusinessScannerProps) {
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  // Selection helpers
  const filteredIds = useMemo(() => new Set(filteredBusinesses.map((b) => b.id)), [filteredBusinesses]);
  const selectedInView = useMemo(() => {
    const s = new Set<string>();
    selectedIds.forEach((id) => { if (filteredIds.has(id)) s.add(id); });
    return s;
  }, [selectedIds, filteredIds]);

  const allFilteredSelected = filteredBusinesses.length > 0 && selectedInView.size === filteredBusinesses.length;
  const someFilteredSelected = selectedInView.size > 0 && !allFilteredSelected;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allFilteredSelected) {
      // Deselect all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [allFilteredSelected, filteredIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  /** Batch status update — works for both demo and API modes */
  const handleBatchUpdate = useCallback(
    async (status: "confirmed" | "review" | "clear") => {
      if (selectedInView.size === 0) return;
      setBatchLoading(true);

      try {
        // Try API batch update
        const numericIds = [...selectedInView].map(Number).filter((n) => !isNaN(n));
        if (numericIds.length > 0) {
          const apiStatus = status === "clear" ? "rejected" as const : status === "review" ? "review" as const : "confirmed" as const;
          await batchReview(numericIds, apiStatus).catch(() => {});
        }

        // Update local state
        setBusinesses(
          businesses.map((b) =>
            selectedInView.has(b.id) ? { ...b, status } : b
          )
        );
        clearSelection();
      } finally {
        setBatchLoading(false);
      }
    },
    [selectedInView, businesses, setBusinesses, clearSelection]
  );

  /** Real pipeline: upload CSV → geocode → scan → load results */
  const processFileReal = useCallback(
    async (file: File) => {
      setApiError(null);
      try {
        // Step 1: Upload CSV to backend
        setStage("uploading");
        await uploadCSV(file);

        // Step 2: Poll until geocoding finishes
        setStage("geocoding");
        await pollUntilDone((status) => {
          setPipelineStatus(status);
          if (!status.geocoding && status.geocode_total > 0) {
            setStage("fetching-imagery");
          }
        });

        // Step 3: Trigger scan batch
        setStage("detecting");
        await startScan(50);
        await pollUntilDone((status) => setPipelineStatus(status));

        // Step 4: Load results from backend
        const locations = await fetchLocations();
        const mapped: Business[] = locations.map((loc) => ({
          id: String(loc.id),
          name: loc.business_name,
          address: loc.address,
          city: "",
          state: "",
          zip: "",
          lat: loc.lat,
          lng: loc.lng,
          containersDetected: loc.containers_detected,
          confidence: loc.max_confidence,
          containerDetails: loc.detection_details?.map((d) => ({
            type: d.type as "40ft" | "other" | "trailer",
            confidence: d.confidence,
            x: d.x,
            y: d.y,
            width: d.width,
            height: d.height,
            excluded: d.excluded,
          })),
          status: loc.status === "needs_review" ? "review"
                : loc.status === "confirmed"    ? "confirmed"
                : loc.status === "rejected"     ? "clear"
                : "pending",
          scanId: loc.scan_id ?? undefined,
          hasImagery: loc.has_imagery,
          detectionBackend: loc.detection_backend ?? undefined,
        }));

        setBusinesses(mapped);
        setStage("complete");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setApiError(msg);
        setStage("idle");
      }
    },
    [setBusinesses]
  );

  /** Demo/mock pipeline: uses mock data with simulated delays */
  const processFile = useCallback(
    async (raw: Business[]) => {
      setApiError(null);
      setStage("uploading");
      await delay(800);
      setStage("geocoding");
      await delay(1200);
      setStage("fetching-imagery");
      await delay(1500);
      setStage("detecting");
      await delay(2000);
      const results = processBusinesses(raw);
      setBusinesses(results);
      setStage("complete");
    },
    [setBusinesses]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFileReal(file);
    },
    [processFileReal]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.name.endsWith(".csv")) return;
      processFileReal(file);
    },
    [processFileReal]
  );

  /** Demo button still uses mock data — no backend needed */
  const handleDemo = useCallback(() => {
    processFile(SAMPLE_BUSINESSES);
  }, [processFile]);

  // Export is now handled by ExportMenu component

  const isProcessing = stage !== "idle" && stage !== "complete";

  // Detection Viewer
  if (selectedBusiness) {
    return (
      <DetectionViewer
        business={selectedBusiness}
        onBack={() => setSelectedBusiness(null)}
      />
    );
  }

  // Processing View
  if (isProcessing) {
    const currentIdx = STAGE_ORDER.indexOf(stage);
    const progress = ((currentIdx + 0.5) / STAGE_ORDER.length) * 100;

    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl p-10 border border-ice-200 text-center max-w-md w-full shadow-sm">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-navy-950 flex items-center justify-center">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#C7A39B"
              strokeWidth="2"
              className="animate-spin"
              style={{ animationDuration: "3s" }}
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>

          <h2 className="text-lg font-bold text-navy-950 mb-2">
            Analyzing Locations
          </h2>
          <p className="text-sm text-steel-500 mb-4">{STAGE_LABELS[stage]}</p>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-ice-200 rounded-full overflow-hidden mb-8">
            <div
              className="h-full bg-blush-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Progress Steps */}
          <div className="space-y-3 text-left">
            {STAGE_ORDER.map((s, i) => {
              const isDone = i < currentIdx;
              const isCurrent = s === stage;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isDone
                        ? "bg-emerald-100 text-emerald-600"
                        : isCurrent
                        ? "bg-blush-400 text-navy-950 shadow-sm shadow-blush-400/30"
                        : "bg-ice-200 text-steel-400"
                    }`}
                  >
                    {isDone ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-sm transition-colors ${
                      isCurrent
                        ? "text-navy-950 font-medium"
                        : isDone
                        ? "text-emerald-600"
                        : "text-steel-400"
                    }`}
                  >
                    {STAGE_LABELS[s]}
                  </span>
                  {isCurrent && (
                    <span className="ml-auto">
                      <span className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blush-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-blush-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-blush-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Upload View
  if (stage === "idle") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-navy-950">Business Scanner</h2>
          <p className="text-sm text-steel-500 mt-1">
            Upload a CSV of businesses to scan for container presence via
            satellite imagery
          </p>
        </div>

        {/* API Error Banner */}
        {apiError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-700">Pipeline error</p>
              <p className="text-xs text-red-600 mt-0.5">{apiError}</p>
              <p className="text-xs text-red-500 mt-1">Make sure the backend is running: <code className="font-mono bg-red-100 px-1 rounded">python run_web.py</code></p>
            </div>
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`bg-white rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
            dragOver
              ? "border-blush-400 bg-blush-400/5 shadow-lg shadow-blush-400/10"
              : "border-ice-200 hover:border-blush-400"
          }`}
        >
          <div className={`w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center transition-colors ${
            dragOver ? "bg-blush-400/20" : "bg-ice-100"
          }`}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dragOver ? "#C7A39B" : "#8FA3BD"}
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3 className="font-semibold text-navy-950 mb-1">
            {dragOver ? "Drop CSV file here" : "Upload CSV File"}
          </h3>
          <p className="text-sm text-steel-500 mb-4">
            Drag & drop a CSV file, or click to browse. Columns: Business Name, Address, City, State, Zip
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-navy-950 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-navy-800 transition-colors"
            >
              Choose File
            </button>
            <button
              onClick={handleDemo}
              className="bg-blush-400 text-navy-950 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blush-300 transition-all hover:shadow-md hover:shadow-blush-400/20"
            >
              Load Demo Data
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* CSV Format Guide */}
        <div className="bg-white rounded-xl border border-ice-200 p-5">
          <h4 className="text-sm font-semibold text-navy-950 mb-3">
            Expected CSV Format
          </h4>
          <div className="bg-ice-100 rounded-lg p-3 font-mono text-xs text-navy-800">
            <p className="font-semibold">Business Name, Address, City, State, Zip</p>
            <p className="text-steel-500 mt-1">
              Phoenix Industrial Supply, 1800 W Industrial Ave, Phoenix, AZ, 85009
            </p>
            <p className="text-steel-500">
              Desert Ridge Construction, 4525 E Baseline Rd, Mesa, AZ, 85206
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Results View
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-950">Scan Results</h2>
          <p className="text-sm text-steel-500 mt-0.5">
            {businesses.length} businesses analyzed &middot;{" "}
            {businesses.reduce((s, b) => s + (b.containersDetected ?? 0), 0)} containers detected
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setStage("idle");
              setBusinesses([]);
              clearSelection();
            }}
            className="border border-ice-200 text-steel-600 px-4 py-2 rounded-lg text-sm hover:border-navy-800 hover:text-navy-950 transition-colors"
          >
            New Scan
          </button>
          <ExportMenu businesses={businesses} reportTitle="Container Detection Report" />
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        isFiltered={isFiltered}
        counts={counts}
        totalFiltered={filteredBusinesses.length}
      />

      {/* Batch Action Bar */}
      {selectedInView.size > 0 && (
        <div className="bg-navy-950 rounded-xl px-4 py-3 flex items-center justify-between shadow-lg animate-in">
          <div className="flex items-center gap-3">
            <span className="bg-blush-400 text-navy-950 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {selectedInView.size}
            </span>
            <span className="text-sm text-white">
              {selectedInView.size === 1 ? "business" : "businesses"} selected
              {isFiltered && selectedInView.size < selectedIds.size && (
                <span className="text-steel-400 ml-1">
                  ({selectedIds.size} total)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <BatchButton
              label="Confirm"
              color="bg-emerald-500 hover:bg-emerald-600 text-white"
              icon={<CheckIcon />}
              onClick={() => handleBatchUpdate("confirmed")}
              loading={batchLoading}
            />
            <BatchButton
              label="Review"
              color="bg-amber-500 hover:bg-amber-600 text-white"
              icon={<EyeIcon />}
              onClick={() => handleBatchUpdate("review")}
              loading={batchLoading}
            />
            <BatchButton
              label="Clear"
              color="bg-slate-500 hover:bg-slate-600 text-white"
              icon={<XIcon />}
              onClick={() => handleBatchUpdate("clear")}
              loading={batchLoading}
            />
            <div className="w-px h-5 bg-navy-700 mx-1" />
            <button
              onClick={clearSelection}
              className="text-xs text-steel-400 hover:text-white transition-colors px-2 py-1"
            >
              Deselect all
            </button>
          </div>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-ice-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ice-200 bg-ice-100/80">
              <th className="text-center px-3 py-3 w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  indeterminate={someFilteredSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="text-left text-xs font-semibold text-steel-600 px-4 py-3">
                Business Name
              </th>
              <th className="text-left text-xs font-semibold text-steel-600 px-4 py-3">
                Address
              </th>
              <th className="text-center text-xs font-semibold text-steel-600 px-4 py-3">
                Containers
              </th>
              <th className="text-center text-xs font-semibold text-steel-600 px-4 py-3">
                Confidence
              </th>
              <th className="text-center text-xs font-semibold text-steel-600 px-4 py-3">
                Status
              </th>
              <th className="text-center text-xs font-semibold text-steel-600 px-4 py-3">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ice-200">
            {filteredBusinesses.map((biz) => {
              const isSelected = selectedIds.has(biz.id);
              return (
                <tr
                  key={biz.id}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-blush-400/10 hover:bg-blush-400/15"
                      : "hover:bg-blush-400/5"
                  }`}
                  onClick={() => setSelectedBusiness(biz)}
                >
                  <td className="text-center px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleOne(biz.id)}
                      aria-label={`Select ${biz.name}`}
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-navy-950">
                      {biz.name}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-steel-600">
                      {biz.address}, {biz.city}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-sm font-bold ${
                      (biz.containersDetected ?? 0) > 0 ? "text-navy-950" : "text-steel-400"
                    }`}>
                      {biz.containersDetected}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <ConfidenceBar value={biz.confidence ?? 0} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <StatusBadge status={biz.status ?? "pending"} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBusiness(biz);
                      }}
                      className="text-xs text-blush-400 hover:text-navy-950 font-medium transition-colors inline-flex items-center gap-1"
                    >
                      View
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 90 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-slate-300";
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-16 h-1.5 bg-ice-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs w-8 font-medium ${
        pct >= 90 ? "text-emerald-600" : pct >= 45 ? "text-amber-600" : "text-steel-500"
      }`}>
        {pct}%
      </span>
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

function Checkbox({
  checked,
  indeterminate,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
        checked || indeterminate
          ? "bg-blush-400 border-blush-400"
          : "border-steel-400 hover:border-navy-800"
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {indeterminate && !checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )}
    </button>
  );
}

function BatchButton({
  label,
  color,
  icon,
  onClick,
  loading,
}: {
  label: string;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`${color} text-xs font-semibold px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1.5 disabled:opacity-50`}
    >
      {icon}
      {label}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
