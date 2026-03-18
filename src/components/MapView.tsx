"use client";

import { useState, useMemo, useCallback } from "react";
import MapGL, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import { Business } from "@/lib/types";
import FilterBar, { FilterState } from "./FilterBar";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface MapViewProps {
  businesses: Business[];
  onSelectBusiness?: (business: Business) => void;
  filters: FilterState;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
  isFiltered: boolean;
  counts: Record<string, number>;
  filteredBusinesses: Business[];
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#10b981",
  review: "#f59e0b",
  clear: "#94a3b8",
  pending: "#cbd5e1",
  processing: "#60a5fa",
};

export default function MapView({
  businesses,
  onSelectBusiness,
  filters,
  updateFilter,
  resetFilters,
  isFiltered,
  counts,
  filteredBusinesses,
}: MapViewProps) {
  const [popupBusiness, setPopupBusiness] = useState<Business | null>(null);

  const geoBusinesses = useMemo(
    () => filteredBusinesses.filter((b) => b.lat && b.lng),
    [filteredBusinesses]
  );

  // Use all geo businesses for initial bounds (not just filtered)
  const allGeoBusinesses = useMemo(
    () => businesses.filter((b) => b.lat && b.lng),
    [businesses]
  );

  const bounds = useMemo(() => {
    if (allGeoBusinesses.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const b of allGeoBusinesses) {
      if (b.lat! < minLat) minLat = b.lat!;
      if (b.lat! > maxLat) maxLat = b.lat!;
      if (b.lng! < minLng) minLng = b.lng!;
      if (b.lng! > maxLng) maxLng = b.lng!;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [allGeoBusinesses]);

  const initialViewState = useMemo(() => {
    if (!bounds) {
      // Default to Phoenix area
      return { latitude: 33.45, longitude: -111.94, zoom: 10 };
    }
    return {
      latitude: (bounds.minLat + bounds.maxLat) / 2,
      longitude: (bounds.minLng + bounds.maxLng) / 2,
      zoom: 10,
    };
  }, [bounds]);

  const handleMarkerClick = useCallback((b: Business) => {
    setPopupBusiness(b);
  }, []);

  // Summary stats (from filtered set)
  const confirmed = geoBusinesses.filter((b) => b.status === "confirmed").length;
  const review = geoBusinesses.filter((b) => b.status === "review").length;
  const clear = geoBusinesses.filter((b) => b.status === "clear").length;
  const totalContainers = geoBusinesses.reduce(
    (sum, b) => sum + (b.containersDetected ?? 0),
    0
  );

  if (!MAPBOX_TOKEN) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy-950">Map Overview</h2>
            <p className="text-sm text-steel-500">
              Geospatial view of all scanned businesses
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-ice-200 shadow-sm overflow-hidden">
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-navy-950 flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C7A39B" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-navy-950 mb-2">Mapbox Token Required</h3>
            <p className="text-sm text-steel-500 max-w-md mb-4">
              Add your Mapbox access token to <code className="bg-ice-100 px-1.5 py-0.5 rounded text-xs font-mono">.env.local</code> to
              enable the interactive map with real satellite imagery.
            </p>
            <code className="bg-navy-950 text-blush-400 text-xs px-4 py-2 rounded-lg font-mono">
              NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-950">Map Overview</h2>
          <p className="text-sm text-steel-500">
            {geoBusinesses.length} businesses with geolocation data
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-steel-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
            Review
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
            Clear
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <SummaryCard label="Mapped Sites" value={String(geoBusinesses.length)} />
        <SummaryCard label="Total Containers" value={String(totalContainers)} color="text-blush-400" />
        <SummaryCard label="Confirmed Leads" value={String(confirmed)} color="text-emerald-600" />
        <SummaryCard label="Needs Review" value={String(review)} color="text-amber-600" />
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        isFiltered={isFiltered}
        counts={counts}
        totalFiltered={geoBusinesses.length}
        compact
      />

      {/* Map */}
      <div className="bg-white rounded-xl border border-ice-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-ice-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-950">Satellite View</h3>
          <span className="text-[10px] bg-ice-100 text-steel-500 px-2 py-0.5 rounded">
            Mapbox Satellite
          </span>
        </div>
        <div style={{ height: 520 }}>
          <MapGL
            initialViewState={initialViewState}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="top-right" />

            {geoBusinesses.map((b) => (
              <Marker
                key={b.id}
                latitude={b.lat!}
                longitude={b.lng!}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  handleMarkerClick(b);
                }}
              >
                <MapPin
                  color={STATUS_COLORS[b.status ?? "pending"]}
                  count={b.containersDetected ?? 0}
                />
              </Marker>
            ))}

            {popupBusiness && (
              <Popup
                latitude={popupBusiness.lat!}
                longitude={popupBusiness.lng!}
                anchor="bottom"
                offset={30}
                onClose={() => setPopupBusiness(null)}
                closeOnClick={false}
              >
                <div className="p-1 min-w-[200px]">
                  <h4 className="font-bold text-sm text-navy-950">{popupBusiness.name}</h4>
                  <p className="text-xs text-steel-500 mt-0.5">
                    {popupBusiness.address}, {popupBusiness.city}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="font-semibold text-blush-400">
                      {popupBusiness.containersDetected ?? 0} containers
                    </span>
                    <span className="text-steel-400">
                      {Math.round((popupBusiness.confidence ?? 0) * 100)}% conf
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusPill status={popupBusiness.status ?? "pending"} />
                    {popupBusiness.opportunityScore != null && (
                      <span className="text-[10px] text-steel-500">
                        Opp: {popupBusiness.opportunityScore}/100
                      </span>
                    )}
                  </div>
                  {onSelectBusiness && (
                    <button
                      onClick={() => onSelectBusiness(popupBusiness)}
                      className="mt-2 w-full text-xs bg-navy-950 text-white py-1.5 rounded-lg hover:bg-navy-800 transition-colors"
                    >
                      View Details
                    </button>
                  )}
                </div>
              </Popup>
            )}
          </MapGL>
        </div>
      </div>
    </div>
  );
}

function MapPin({ color, count }: { color: string; count: number }) {
  return (
    <div className="relative cursor-pointer group">
      <svg width="32" height="40" viewBox="0 0 32 40" className="drop-shadow-lg transition-transform group-hover:scale-110">
        <path
          d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24C32 7.163 24.837 0 16 0z"
          fill={color}
        />
        <circle cx="16" cy="15" r="8" fill="white" fillOpacity="0.9" />
        <text
          x="16"
          y="18"
          textAnchor="middle"
          fill={color}
          fontSize="10"
          fontWeight="700"
          fontFamily="system-ui"
        >
          {count}
        </text>
      </svg>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: "bg-emerald-100 text-emerald-700",
    review: "bg-amber-100 text-amber-700",
    clear: "bg-slate-100 text-slate-600",
    pending: "bg-slate-100 text-slate-400",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-ice-200 p-3">
      <p className="text-[10px] text-steel-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold ${color ?? "text-navy-950"}`}>{value}</p>
    </div>
  );
}
