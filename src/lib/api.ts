// src/lib/api.ts
// ─────────────────────────────────────────────────────────────
// Container Hunter — FastAPI Backend Client
//
// All HTTP calls to the Python FastAPI backend live here.
// Set NEXT_PUBLIC_API_URL in .env.local to point to your server.
// Defaults to http://localhost:8000 for local development.
// ─────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

// ── Types matching FastAPI responses ─────────────────────────

export interface ApiStats {
  confirmed: number;
  needs_review: number;
  rejected: number;
  pending: number;
  scan_failed: number;
}

export interface ApiLocation {
  id: number;
  business_name: string;
  address: string;
  lat: number;
  lng: number;
  status: string;
  containers_detected: number;
  max_confidence: number;
  scan_id: number | null;
  has_imagery: boolean;
  detection_backend: string | null;
  detection_details: Array<{
    type: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    excluded?: boolean;
  }>;
}

export interface ApiReview {
  scan_id: number;
  business_id: number;
  business_name: string;
  address: string;
  lat: number;
  lng: number;
  containers_detected: number;
  max_confidence: number;
  status: string;
  scanned_at: string;
  imagery_note: string;
  has_imagery: boolean;
  detection_backend: string;
  detection_details: Array<{
    type: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
    excluded?: boolean;
  }>;
}

export interface ModelStatus {
  backend: string;
  model_name: string;
  confidence_floor: number;
  img_size: [number, number];
  container_classes: string[];
}

export interface PipelineStatus {
  geocoding: boolean;
  scanning: boolean;
  geocode_progress: number;
  geocode_total: number;
  scan_progress: number;
  scan_total: number;
  last_error: string | null;
}

export interface ApiConfig {
  google_maps_api_key: string;
  auto_approve_threshold: number;
  confidence_threshold: number;
}

// ── Helpers ───────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Endpoints ─────────────────────────────────────────────────

/** GET /api/stats — queue summary counts */
export async function fetchStats(): Promise<ApiStats> {
  return apiFetch<ApiStats>("/api/stats");
}

/** GET /api/locations — all geocoded businesses with latest scan status */
export async function fetchLocations(): Promise<ApiLocation[]> {
  const data = await apiFetch<{ locations: ApiLocation[] }>("/api/locations");
  return data.locations;
}

/** GET /api/pipeline/status — current geocode/scan progress */
export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  return apiFetch<PipelineStatus>("/api/pipeline/status");
}

/** GET /api/config — public settings (Maps API key, thresholds) */
export async function fetchConfig(): Promise<ApiConfig> {
  return apiFetch<ApiConfig>("/api/config");
}

/** GET /api/model/status — ML detection backend info */
export async function fetchModelStatus(): Promise<ModelStatus> {
  return apiFetch<ModelStatus>("/api/model/status");
}

/** Build URL for satellite imagery endpoint */
export function imageryUrl(scanId: number): string {
  return `${API_BASE}/api/imagery/${scanId}`;
}

/**
 * POST /api/upload — upload a CSV file, kicks off geocoding
 * Returns { message, count, skipped }
 */
export async function uploadCSV(
  file: File
): Promise<{ message: string; count: number; skipped: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Upload failed: ${text}`);
  }
  return res.json();
}

/** POST /api/scan — start a scan batch */
export async function startScan(
  batchSize = 50
): Promise<{ message: string; batch_size: number }> {
  return apiFetch("/api/scan", {
    method: "POST",
    body: JSON.stringify({ batch_size: batchSize }),
  });
}

/** GET /api/reviews/pending — scans waiting for human review */
export async function fetchPendingReviews(
  limit = 20
): Promise<ApiReview[]> {
  const data = await apiFetch<{ reviews: ApiReview[] }>(
    `/api/reviews/pending?limit=${limit}`
  );
  return data.reviews;
}

/** POST /api/reviews/:scan_id — confirm or reject a scan */
export async function submitReview(
  scanId: number,
  status: "confirmed" | "rejected",
  notes?: string
): Promise<{ ok: boolean; scan_id: number; status: string }> {
  return apiFetch(`/api/reviews/${scanId}`, {
    method: "POST",
    body: JSON.stringify({ status, notes }),
  });
}

/** POST /api/reviews/batch — bulk status update for multiple businesses */
export async function batchReview(
  businessIds: number[],
  status: "confirmed" | "rejected" | "review" | "clear",
  notes?: string
): Promise<{ ok: boolean; updated: number; status: string }> {
  return apiFetch("/api/reviews/batch", {
    method: "POST",
    body: JSON.stringify({ business_ids: businessIds, status, notes }),
  });
}

/** GET /api/export — download confirmed detections as CSV blob */
export async function downloadExport(): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Export failed: ${text}`);
  }
  return res.blob();
}

/**
 * Poll pipeline status until both geocoding and scanning are done.
 * Calls onProgress on each tick.
 */
export async function pollUntilDone(
  onProgress: (status: PipelineStatus) => void,
  intervalMs = 1500,
  timeoutMs = 300_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (Date.now() > deadline) {
        reject(new Error("Pipeline polling timed out after 5 minutes."));
        return;
      }
      try {
        const status = await fetchPipelineStatus();
        onProgress(status);
        if (status.last_error) {
          reject(new Error(status.last_error));
          return;
        }
        if (!status.geocoding && !status.scanning) {
          resolve();
          return;
        }
      } catch (e) {
        // backend not yet ready — keep polling
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}
