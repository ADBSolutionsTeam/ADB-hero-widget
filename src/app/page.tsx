"use client";

import { useState } from "react";
import { Business } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import BusinessScanner from "@/components/BusinessScanner";
import ConstructionIntel from "@/components/ConstructionIntel";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [businesses, setBusinesses] = useState<Business[]>([]);

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
              setBusinesses={setBusinesses}
            />
          )}
          {activeTab === "construction" && (
            <ConstructionIntel businesses={businesses} />
          )}
        </div>
      </main>
    </div>
  );
}
