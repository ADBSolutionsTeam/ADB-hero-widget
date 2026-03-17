"use client";

import { useState, useCallback, useRef } from "react";
import { Business, ProcessingStage } from "@/lib/types";
import { parseCSV, processBusinesses, exportToCSV, SAMPLE_BUSINESSES } from "@/lib/mock-data";
import DetectionViewer from "./DetectionViewer";

interface BusinessScannerProps {
  businesses: Business[];
  setBusinesses: (businesses: Business[]) => void;
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
}: BusinessScannerProps) {
  const [stage, setStage] = useState<ProcessingStage>("idle");
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (raw: Business[]) => {
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

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length > 0) {
          processFile(parsed);
        }
      };
      reader.readAsText(file);
    },
    [processFile]
  );

  const handleDemo = useCallback(() => {
    processFile(SAMPLE_BUSINESSES);
  }, [processFile]);

  const handleExport = useCallback(() => {
    const csv = exportToCSV(businesses);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "container-hunter-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [businesses]);

  const filteredBusinesses =
    filter === "all"
      ? businesses
      : businesses.filter((b) => b.status === filter);

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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl p-10 border border-ice-200 text-center max-w-md w-full">
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
          <p className="text-sm text-steel-500 mb-8">{STAGE_LABELS[stage]}</p>

          {/* Progress Steps */}
          <div className="space-y-3 text-left">
            {STAGE_ORDER.map((s, i) => {
              const currentIdx = STAGE_ORDER.indexOf(stage);
              const isDone = i < currentIdx;
              const isCurrent = s === stage;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDone
                        ? "bg-emerald-100 text-emerald-600"
                        : isCurrent
                        ? "bg-blush-400 text-navy-950"
                        : "bg-ice-200 text-steel-400"
                    }`}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-sm ${
                      isCurrent
                        ? "text-navy-950 font-medium"
                        : isDone
                        ? "text-steel-500"
                        : "text-steel-400"
                    }`}
                  >
                    {STAGE_LABELS[s]}
                  </span>
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

        <div className="bg-white rounded-2xl border-2 border-dashed border-ice-200 p-12 text-center hover:border-blush-400 transition-colors">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-ice-100 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8FA3BD"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h3 className="font-semibold text-navy-950 mb-1">Upload CSV File</h3>
          <p className="text-sm text-steel-500 mb-4">
            Columns: Business Name, Address, City, State, Zip
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
              className="bg-blush-400 text-navy-950 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blush-300 transition-colors"
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
            <p>Business Name, Address, City, State, Zip</p>
            <p className="text-steel-500">
              Phoenix Industrial Supply, 1800 W Industrial Ave, Phoenix, AZ,
              85009
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
            {businesses.length} businesses analyzed
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setStage("idle");
              setBusinesses([]);
            }}
            className="border border-ice-200 text-steel-600 px-4 py-2 rounded-lg text-sm hover:border-navy-800 hover:text-navy-950 transition-colors"
          >
            New Scan
          </button>
          <button
            onClick={handleExport}
            className="bg-navy-950 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-navy-800 transition-colors flex items-center gap-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { key: "all", label: "All" },
          { key: "confirmed", label: "Confirmed" },
          { key: "review", label: "Needs Review" },
          { key: "clear", label: "Clear" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-navy-950 text-white"
                : "bg-white text-steel-600 border border-ice-200 hover:border-navy-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-ice-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ice-200 bg-ice-100">
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
            {filteredBusinesses.map((biz) => (
              <tr
                key={biz.id}
                className="hover:bg-ice-100/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-navy-950">
                    {biz.name}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-steel-600">
                    {biz.address}, {biz.city}
                  </p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-bold text-navy-950">
                    {biz.containersDetected}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <ConfidenceBar value={biz.confidence ?? 0} />
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={biz.status ?? "pending"} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setSelectedBusiness(biz)}
                    className="text-xs text-blush-400 hover:text-navy-950 font-medium transition-colors"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
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
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-steel-600 w-8">{pct}%</span>
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
