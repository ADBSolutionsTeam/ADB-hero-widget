"use client";

import { useState, useCallback, useMemo } from "react";
import { Business } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import BusinessScanner from "@/components/BusinessScanner";
import ConstructionIntel from "@/components/ConstructionIntel";
import MapView from "@/components/MapView";
import { geocodeBusinesses } from "@/lib/geocode";
import {
  FilterState,
  DEFAULT_FILTERS,
  applyFilters,
  isFilterActive,
  getFilterCounts,
} from "@/components/FilterBar";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [businesses, setBusinesses] = useState<Business[]>([]);

  // Shared filter state — persists across tab switches
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const filteredBusinesses = useMemo(
    () => applyFilters(businesses, filters),
    [businesses, filters]
  );
  const isFiltered = isFilterActive(filters);
  const filterCounts = useMemo(() => getFilterCounts(businesses), [businesses]);

  const handleSetBusinesses = useCallback(
    (update: Business[] | ((prev: Business[]) => Business[])) => {
      setBusinesses((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        const needsGeocoding = next.some((b) => !b.lat || !b.lng);
        if (needsGeocoding) {
          geocodeBusinesses(next).then((geocoded) => {
            setBusinesses(geocoded);
          });
        }
        return next;
      });
    },
    []
  );

  const sharedFilterProps = {
    filters,
    updateFilter,
    resetFilters,
    isFiltered,
    counts: filterCounts,
    filteredBusinesses,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} businesses={businesses} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          {activeTab === "dashboard" && (
            <Dashboard businesses={businesses} onNavigate={setActiveTab} />
          )}
          {activeTab === "scanner" && (
            <BusinessScanner
              businesses={businesses}
              setBusinesses={handleSetBusinesses}
              {...sharedFilterProps}
            />
          )}
          {activeTab === "map" && (
            <MapView
              businesses={businesses}
              {...sharedFilterProps}
            />
          )}
          {activeTab === "construction" && (
            <ConstructionIntel
              businesses={businesses}
              {...sharedFilterProps}
            />
          )}
        </div>
      </main>
    </div>
  );
}
