"use client";

import { useState, useRef, useEffect } from "react";
import { Business } from "@/lib/types";
import { generatePDFReport, generateEnhancedCSV } from "@/lib/pdf-report";

interface ExportMenuProps {
  businesses: Business[];
  reportTitle?: string;
  label?: string;
}

export default function ExportMenu({
  businesses,
  reportTitle,
  label = "Export",
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const download = (content: string | Blob, filename: string, mime: string) => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dateStr = new Date().toISOString().split("T")[0];

  const handleCSV = () => {
    const csv = generateEnhancedCSV(businesses);
    download(csv, `container-hunter-${dateStr}.csv`, "text/csv");
    showToast("CSV exported");
    setOpen(false);
  };

  const handlePDF = () => {
    const doc = generatePDFReport(businesses, reportTitle);
    const blob = doc.output("blob");
    download(blob, `container-hunter-${dateStr}.pdf`, "application/pdf");
    showToast("PDF report generated");
    setOpen(false);
  };

  const handlePDFPreview = () => {
    const doc = generatePDFReport(businesses, reportTitle);
    const url = doc.output("bloburl");
    window.open(url as unknown as string, "_blank");
    setOpen(false);
  };

  const disabled = businesses.length === 0;

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            disabled
              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
              : "bg-navy-950 text-white hover:bg-navy-800"
          }`}
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
          {label}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl border border-ice-200 shadow-xl z-50 overflow-hidden">
            <button
              onClick={handleCSV}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-navy-950 hover:bg-ice-100 transition-colors text-left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div>
                <p className="font-semibold">Export CSV</p>
                <p className="text-[10px] text-steel-500">Enhanced with coordinates & details</p>
              </div>
            </button>

            <div className="border-t border-ice-200" />

            <button
              onClick={handlePDF}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-navy-950 hover:bg-ice-100 transition-colors text-left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C7A39B" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <div>
                <p className="font-semibold">Download PDF Report</p>
                <p className="text-[10px] text-steel-500">Branded report with charts & details</p>
              </div>
            </button>

            <div className="border-t border-ice-200" />

            <button
              onClick={handlePDFPreview}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-navy-950 hover:bg-ice-100 transition-colors text-left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8FA3BD" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <div>
                <p className="font-semibold">Preview PDF</p>
                <p className="text-[10px] text-steel-500">Open in new tab</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 bg-navy-950 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 z-50 animate-slide-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}
    </>
  );
}
