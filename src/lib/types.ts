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
