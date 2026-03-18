export interface Business {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  containersDetected?: number;
  containerDetails?: ContainerDetection[];
  confidence?: number;
  status?: "pending" | "processing" | "confirmed" | "review" | "clear";
  satelliteImage?: string;
  constructionScore?: number;
  opportunityScore?: number;
  estimatedDemand?: string;
  constructionPhase?: string;
  scanId?: number;
  hasImagery?: boolean;
  detectionBackend?: string;
}

export interface ContainerDetection {
  type: "40ft" | "other" | "trailer";
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  excluded?: boolean;
}

export type ProcessingStage =
  | "idle"
  | "uploading"
  | "geocoding"
  | "fetching-imagery"
  | "detecting"
  | "complete";

// ── Area Scanner Types ──────────────────────────────────────────────

export interface ScanBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface ScanArea {
  center: { lat: number; lng: number };
  bounds: ScanBounds;
  areaSqMiles: number;
  tileCount: number;
  estimatedScanTime: number; // seconds
}

export type ScanStage =
  | "idle"
  | "selecting"
  | "selected"
  | "scanning"
  | "complete";

export interface ScanProgressStep {
  label: string;
  status: "pending" | "active" | "complete";
}

export type DetectionCategory =
  | "container-40ft"
  | "container-other"
  | "excavator"
  | "bulldozer"
  | "crane"
  | "dump-truck"
  | "cleared-land"
  | "active-site"
  | "foundation-work"
  | "material-staging";

export interface AreaScanResult {
  id: string;
  lat: number;
  lng: number;
  category: DetectionCategory;
  label: string;
  group: "containers" | "equipment" | "construction";
  confidence: number;
  opportunityScore?: number;
  tileId: string;
  address?: string;
}
