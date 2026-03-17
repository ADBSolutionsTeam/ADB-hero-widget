"use client";

import { useState, useCallback } from "react";
import { Business } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import BusinessScanner from "@/components/BusinessScanner";
import ConstructionIntel from "@/components/ConstructionIntel";
import MapView from "@/components/MapView";
import { geocodeBusinesses } from "@/lib/geocode";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [businesses, setBusinesses] = useState<Business[]>([]);

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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          {activeTab === "dashboard" && (
            <Dashboard businesses={businesses} onNavigate={setActiveTab} />
          )}
          {activeTab === "scanner" && (
            <BusinessScanner
              businesses={businesses}
              setBusinesses={handleSetBusinesses}
            />
          )}
          {activeTab === "map" && (
            <MapView businesses={businesses} />
          )}
          {activeTab === "construction" && (
            <ConstructionIntel businesses={businesses} />
          )}
        </div>
      </main>
    </div>
  );
}
