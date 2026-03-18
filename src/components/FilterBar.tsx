"use client";

import { useState, useMemo, useCallback } from "react";
import { Business } from "@/lib/types";

// ── Filter state shape ───────────────────────────────────────

export interface FilterState {
  status: string;
  confidenceMin: number;
  confidenceMax: number;
  opportunityMin: number;
  opportunityMax: number;
  containersMin: number;
  containersMax: number;
  search: string;
}

export const DEFAULT_FILTERS: FilterState = {
  status: "all",
  confidenceMin: 0,
  confidenceMax: 100,
  opportunityMin: 0,
  opportunityMax: 100,
  containersMin: 0,
  containersMax: 50,
  search: "",
};

// ── Pure filter function (usable without hook) ───────────────

export function applyFilters(businesses: Business[], filters: FilterState): Business[] {
  return businesses.filter((b) => {
    // Status
    if (filters.status !== "all" && b.status !== filters.status) return false;

    // Confidence range
    const conf = Math.round((b.confidence ?? 0) * 100);
    if (conf < filters.confidenceMin || conf > filters.confidenceMax) return false;

    // Opportunity range
    const opp = b.opportunityScore ?? 0;
    if (opp < filters.opportunityMin || opp > filters.opportunityMax) return false;

    // Containers range
    const cnt = b.containersDetected ?? 0;
    if (cnt < filters.containersMin || cnt > filters.containersMax) return false;

    // Text search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = `${b.name} ${b.address} ${b.city} ${b.state} ${b.zip}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

export function isFilterActive(filters: FilterState): boolean {
  return (
    filters.status !== "all" ||
    filters.confidenceMin > 0 ||
    filters.confidenceMax < 100 ||
    filters.opportunityMin > 0 ||
    filters.opportunityMax < 100 ||
    filters.containersMin > 0 ||
    filters.containersMax < 50 ||
    filters.search !== ""
  );
}

export function getFilterCounts(businesses: Business[]) {
  return {
    all: businesses.length,
    confirmed: businesses.filter((b) => b.status === "confirmed").length,
    review: businesses.filter((b) => b.status === "review").length,
    clear: businesses.filter((b) => b.status === "clear").length,
  };
}

// ── Hook for local filter state (standalone use) ─────────────

export function useBusinessFilters(businesses: Business[]) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const filtered = useMemo(() => applyFilters(businesses, filters), [businesses, filters]);
  const isFiltered = isFilterActive(filters);
  const counts = useMemo(() => getFilterCounts(businesses), [businesses]);

  return { filters, updateFilter, resetFilters, filtered, isFiltered, counts };
}

// ── FilterBar component ──────────────────────────────────────

interface FilterBarProps {
  filters: FilterState;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  isFiltered: boolean;
  counts: Record<string, number>;
  totalFiltered: number;
  compact?: boolean;
}

const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "confirmed", label: "Confirmed" },
  { key: "review", label: "Review" },
  { key: "clear", label: "Clear" },
] as const;

export default function FilterBar({
  filters,
  updateFilter,
  resetFilters,
  isFiltered,
  counts,
  totalFiltered,
  compact = false,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  // Count active advanced filters for badge
  const advancedCount = [
    filters.confidenceMin > 0 || filters.confidenceMax < 100,
    filters.opportunityMin > 0 || filters.opportunityMax < 100,
    filters.containersMin > 0 || filters.containersMax < 50,
  ].filter(Boolean).length;

  return (
    <div className="space-y-2">
      {/* Row 1: Status pills + search + expand toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status pills */}
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => updateFilter("status", s.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filters.status === s.key
                ? "bg-navy-950 text-white"
                : "bg-white text-steel-600 border border-ice-200 hover:border-navy-800"
            }`}
          >
            {s.label}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                filters.status === s.key ? "bg-white/20" : "bg-ice-100"
              }`}
            >
              {counts[s.key] ?? 0}
            </span>
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel-400"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search businesses..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-ice-200 rounded-lg w-48 focus:outline-none focus:border-navy-800 text-navy-950 placeholder:text-steel-400"
          />
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            expanded || advancedCount > 0
              ? "bg-blush-100 text-blush-700 border border-blush-200"
              : "bg-white text-steel-600 border border-ice-200 hover:border-navy-800"
          }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Filters
          {advancedCount > 0 && !expanded && (
            <span className="bg-blush-400 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {advancedCount}
            </span>
          )}
        </button>

        {/* Reset */}
        {isFiltered && (
          <button
            onClick={resetFilters}
            className="text-xs text-steel-500 hover:text-navy-950 transition-colors underline underline-offset-2"
          >
            Reset
          </button>
        )}
      </div>

      {/* Row 2: Advanced filters (expandable) */}
      {expanded && (
        <div
          className={`flex items-center gap-6 bg-white border border-ice-200 rounded-xl flex-wrap ${
            compact ? "px-4 py-3" : "px-5 py-4"
          }`}
        >
          {/* Confidence Range */}
          <RangeFilter
            label="Confidence"
            suffix="%"
            min={0}
            max={100}
            valueMin={filters.confidenceMin}
            valueMax={filters.confidenceMax}
            onChangeMin={(v) => updateFilter("confidenceMin", v)}
            onChangeMax={(v) => updateFilter("confidenceMax", v)}
          />

          <div className="w-px h-8 bg-ice-200" />

          {/* Opportunity Score Range */}
          <RangeFilter
            label="Opportunity"
            suffix=""
            min={0}
            max={100}
            valueMin={filters.opportunityMin}
            valueMax={filters.opportunityMax}
            onChangeMin={(v) => updateFilter("opportunityMin", v)}
            onChangeMax={(v) => updateFilter("opportunityMax", v)}
          />

          <div className="w-px h-8 bg-ice-200" />

          {/* Containers Detected Range */}
          <RangeFilter
            label="Containers"
            suffix=""
            min={0}
            max={50}
            valueMin={filters.containersMin}
            valueMax={filters.containersMax}
            onChangeMin={(v) => updateFilter("containersMin", v)}
            onChangeMax={(v) => updateFilter("containersMax", v)}
          />

          <div className="flex-1" />

          {/* Result count */}
          <span className="text-xs text-steel-500">
            {totalFiltered} of {counts.all} results
          </span>
        </div>
      )}
    </div>
  );
}

// ── Range Filter sub-component ───────────────────────────────

function RangeFilter({
  label,
  suffix,
  min,
  max,
  valueMin,
  valueMax,
  onChangeMin,
  onChangeMax,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChangeMin: (v: number) => void;
  onChangeMax: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-navy-950 whitespace-nowrap">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={valueMin}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value) || 0, valueMax);
            onChangeMin(Math.max(min, v));
          }}
          className="w-14 px-2 py-1 text-xs border border-ice-200 rounded-md text-center text-navy-950 focus:outline-none focus:border-navy-800"
        />
        <span className="text-[10px] text-steel-400">to</span>
        <input
          type="number"
          min={min}
          max={max}
          value={valueMax}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value) || 0, valueMin);
            onChangeMax(Math.min(max, v));
          }}
          className="w-14 px-2 py-1 text-xs border border-ice-200 rounded-md text-center text-navy-950 focus:outline-none focus:border-navy-800"
        />
        {suffix && (
          <span className="text-[10px] text-steel-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}
