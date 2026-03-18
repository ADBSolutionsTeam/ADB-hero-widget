import {
  ScanArea,
  ScanBounds,
  AreaScanResult,
  DetectionCategory,
  ScanProgressStep,
} from "./types";

// ── Geo math ────────────────────────────────────────────────────────

const MILES_TO_DEG_LAT = 1 / 69.0; // ~1 degree lat ≈ 69 miles
function milesToDegLng(lat: number): number {
  return 1 / (69.0 * Math.cos((lat * Math.PI) / 180));
}

/** Create a 3×3 mile scan area centered on a lat/lng */
export function createScanArea(lat: number, lng: number): ScanArea {
  const halfMiles = 1.5;
  const dLat = halfMiles * MILES_TO_DEG_LAT;
  const dLng = halfMiles * milesToDegLng(lat);

  const bounds: ScanBounds = {
    north: lat + dLat,
    south: lat - dLat,
    east: lng + dLng,
    west: lng - dLng,
  };

  // 3×3 mile area → 9 sq miles, split into ~0.5 mile tiles → 36 tiles
  const tileCount = 36;
  // Estimate: ~2 seconds per tile simulated
  const estimatedScanTime = Math.round(tileCount * 0.4 + 8);

  return {
    center: { lat, lng },
    bounds,
    areaSqMiles: 9,
    tileCount,
    estimatedScanTime,
  };
}

/** Convert bounds to GeoJSON polygon for Mapbox (counterclockwise per RFC 7946) */
export function boundsToGeoJSON(bounds: ScanBounds) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.south],
          [bounds.east, bounds.north],
          [bounds.west, bounds.north],
          [bounds.west, bounds.south],
        ],
      ],
    },
  };
}

/** Generate the scan tile grid as GeoJSON for visualization */
export function tilesToGeoJSON(bounds: ScanBounds) {
  const cols = 6;
  const rows = 6;
  const dLat = (bounds.north - bounds.south) / rows;
  const dLng = (bounds.east - bounds.west) / cols;

  const features = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const south = bounds.south + r * dLat;
      const north = south + dLat;
      const west = bounds.west + c * dLng;
      const east = west + dLng;
      features.push({
        type: "Feature" as const,
        properties: { tileId: `tile-${r}-${c}`, row: r, col: c },
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      });
    }
  }

  return {
    type: "FeatureCollection" as const,
    features,
  };
}

// ── Scan progress steps ─────────────────────────────────────────────

export const SCAN_STEPS: string[] = [
  "Preparing scan area...",
  "Generating tile grid...",
  "Fetching satellite imagery...",
  "Analyzing containers...",
  "Analyzing construction equipment...",
  "Detecting construction site signals...",
  "Scoring construction opportunities...",
  "Correlating detections...",
  "Finalizing results...",
];

export function buildProgressSteps(): ScanProgressStep[] {
  return SCAN_STEPS.map((label) => ({ label, status: "pending" }));
}

// ── Mock result generation ──────────────────────────────────────────

function seededRand(seed: number): () => number {
  let s = Math.abs(seed) || 1; // ensure positive non-zero
  return () => {
    s = (s * 16807 + 7) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

const DETECTION_DEFS: {
  category: DetectionCategory;
  label: string;
  group: "containers" | "equipment" | "construction";
  weight: number;
}[] = [
  { category: "container-40ft", label: "40' Storage Container", group: "containers", weight: 6 },
  { category: "container-other", label: "Storage Container (Other)", group: "containers", weight: 3 },
  { category: "excavator", label: "Excavator", group: "equipment", weight: 3 },
  { category: "bulldozer", label: "Bulldozer", group: "equipment", weight: 2 },
  { category: "crane", label: "Crane", group: "equipment", weight: 1 },
  { category: "dump-truck", label: "Dump Truck", group: "equipment", weight: 3 },
  { category: "cleared-land", label: "Cleared Land", group: "construction", weight: 4 },
  { category: "active-site", label: "Active Construction Site", group: "construction", weight: 3 },
  { category: "foundation-work", label: "Foundation Work", group: "construction", weight: 2 },
  { category: "material-staging", label: "Material Staging Area", group: "construction", weight: 2 },
];

const STREET_NAMES = [
  "Industrial Blvd", "Commerce Dr", "Warehouse Rd", "Factory Ln",
  "Distribution Way", "Logistics Pkwy", "Supply Chain Ave", "Freight Rd",
  "Terminal Dr", "Cargo Ln", "Enterprise Blvd", "Business Park Dr",
];

/** Generate believable mock scan results within bounds */
export function generateScanResults(bounds: ScanBounds): AreaScanResult[] {
  const seed = Math.round(bounds.north * 10000 + bounds.west * 10000);
  const rand = seededRand(seed);

  // Generate 18-35 detections for a 3×3 mile area
  const count = 18 + Math.floor(rand() * 18);
  const results: AreaScanResult[] = [];

  // Build weighted pool
  const pool: typeof DETECTION_DEFS = [];
  for (const def of DETECTION_DEFS) {
    for (let i = 0; i < def.weight; i++) pool.push(def);
  }

  // Create clusters (2-5 detections near each other)
  const clusterCount = 4 + Math.floor(rand() * 4);
  const clusters: { lat: number; lng: number }[] = [];
  for (let i = 0; i < clusterCount; i++) {
    clusters.push({
      lat: bounds.south + rand() * (bounds.north - bounds.south),
      lng: bounds.west + rand() * (bounds.east - bounds.west),
    });
  }

  for (let i = 0; i < count; i++) {
    const def = pool[Math.floor(rand() * pool.length)];
    // Pick a cluster and add jitter
    const cluster = clusters[Math.floor(rand() * clusters.length)];
    const jitterLat = (rand() - 0.5) * 0.004;
    const jitterLng = (rand() - 0.5) * 0.005;
    const lat = Math.max(bounds.south, Math.min(bounds.north, cluster.lat + jitterLat));
    const lng = Math.max(bounds.west, Math.min(bounds.east, cluster.lng + jitterLng));

    // Determine tile
    const rows = 6, cols = 6;
    const row = Math.min(5, Math.floor(((lat - bounds.south) / (bounds.north - bounds.south)) * rows));
    const col = Math.min(5, Math.floor(((lng - bounds.west) / (bounds.east - bounds.west)) * cols));

    const confidence = def.group === "containers"
      ? 0.72 + rand() * 0.26
      : def.group === "equipment"
        ? 0.65 + rand() * 0.30
        : 0.58 + rand() * 0.35;

    const streetNum = 100 + Math.floor(rand() * 9900);
    const street = STREET_NAMES[Math.floor(rand() * STREET_NAMES.length)];

    results.push({
      id: `scan-${i}`,
      lat,
      lng,
      category: def.category,
      label: def.label,
      group: def.group,
      confidence: Math.round(confidence * 100) / 100,
      opportunityScore: def.group !== "containers" ? undefined : Math.floor(55 + rand() * 45),
      tileId: `tile-${row}-${col}`,
      address: `${streetNum} ${street}`,
    });
  }

  return results;
}

// ── Location info helpers ───────────────────────────────────────────

export interface LocationInfo {
  city: string;
  state: string;
  county: string;
  zip: string;
}

/** Rough city lookup for demo — covers major US metros */
export function estimateLocation(lat: number, lng: number): LocationInfo {
  // Phoenix metro area
  if (lat > 33.0 && lat < 34.0 && lng > -112.5 && lng < -111.0) {
    if (lat > 33.5) return { city: "Scottsdale", state: "AZ", county: "Maricopa", zip: "85251" };
    if (lng < -112.0) return { city: "Phoenix", state: "AZ", county: "Maricopa", zip: "85009" };
    return { city: "Mesa", state: "AZ", county: "Maricopa", zip: "85201" };
  }
  // Dallas
  if (lat > 32.5 && lat < 33.2 && lng > -97.5 && lng < -96.5) {
    return { city: "Dallas", state: "TX", county: "Dallas", zip: "75201" };
  }
  // Houston
  if (lat > 29.5 && lat < 30.2 && lng > -95.8 && lng < -95.0) {
    return { city: "Houston", state: "TX", county: "Harris", zip: "77001" };
  }
  // LA
  if (lat > 33.7 && lat < 34.3 && lng > -118.5 && lng < -117.5) {
    return { city: "Los Angeles", state: "CA", county: "Los Angeles", zip: "90001" };
  }
  // Denver
  if (lat > 39.5 && lat < 40.0 && lng > -105.2 && lng < -104.5) {
    return { city: "Denver", state: "CO", county: "Denver", zip: "80201" };
  }
  // Default
  return { city: "Unknown", state: "--", county: "Unknown", zip: "-----" };
}

/** Format lat/lng to display string */
export function formatCoord(value: number, type: "lat" | "lng"): string {
  const dir = type === "lat" ? (value >= 0 ? "N" : "S") : (value >= 0 ? "E" : "W");
  return `${Math.abs(value).toFixed(4)}° ${dir}`;
}

// ── Result detail enrichment ────────────────────────────────────────

export interface ResultDetail {
  condition: string;
  conditionColor: string;
  estimatedSize: string;
  actionLabel: string;
  actionDescription: string;
  priority: "high" | "medium" | "low";
  tags: string[];
  notes: string;
}

const CONDITION_LABELS: Record<string, { label: string; color: string }[]> = {
  containers: [
    { label: "In Use — Occupied", color: "#f59e0b" },
    { label: "Stationary — Available", color: "#10b981" },
    { label: "Stacked — Storage Yard", color: "#8FA3BD" },
    { label: "Recently Placed", color: "#22d3ee" },
  ],
  equipment: [
    { label: "Active — Operating", color: "#f59e0b" },
    { label: "Idle — Parked On-Site", color: "#10b981" },
    { label: "In Transit", color: "#22d3ee" },
    { label: "Staged — Ready to Deploy", color: "#8FA3BD" },
  ],
  construction: [
    { label: "Active Development", color: "#f59e0b" },
    { label: "Early Stage — Prep Work", color: "#22d3ee" },
    { label: "Mid Build — Structural Phase", color: "#10b981" },
    { label: "Site Cleared — Pre-Construction", color: "#8FA3BD" },
  ],
};

const ACTION_MAP: Record<DetectionCategory, { label: string; description: string }> = {
  "container-40ft": { label: "Verify & Contact Owner", description: "High-value 40' container detected. Verify placement status and contact property owner for rental opportunity." },
  "container-other": { label: "Classify & Assess", description: "Non-standard container detected. Recommend field classification to determine size and rental potential." },
  "excavator": { label: "Monitor Site Activity", description: "Heavy excavation equipment indicates active groundwork. Monitor for container demand as project progresses." },
  "bulldozer": { label: "Track Site Phase", description: "Grading equipment detected. Site likely in early development — flag for future container needs." },
  "crane": { label: "High-Priority Lead", description: "Crane presence indicates major vertical construction. High probability of container demand for materials staging." },
  "dump-truck": { label: "Assess Material Flow", description: "Active material transport detected. Site may need additional storage containers for staging." },
  "cleared-land": { label: "Watch & Alert", description: "Cleared parcel detected — likely pre-construction. Add to watch list for upcoming container demand." },
  "active-site": { label: "Immediate Outreach", description: "Active construction confirmed. High confidence of current or near-term container rental demand." },
  "foundation-work": { label: "Schedule Follow-Up", description: "Foundation stage detected. Container demand typically peaks in 2-4 weeks during framing phase." },
  "material-staging": { label: "Direct Sales Opportunity", description: "Material staging area without adequate container coverage. Direct outreach recommended." },
};

const SIZE_MAP: Record<DetectionCategory, string> = {
  "container-40ft": "40' × 8' × 8.5' (standard)",
  "container-other": "20' × 8' × 8.5' (estimated)",
  excavator: "~35 ton class",
  bulldozer: "~D6 class (medium)",
  crane: "Mobile crane (~50 ton)",
  "dump-truck": "Articulated hauler",
  "cleared-land": "~0.5–2 acres (estimated)",
  "active-site": "~1–5 acres (estimated)",
  "foundation-work": "~0.25–1 acre footprint",
  "material-staging": "~0.1–0.5 acre area",
};

const TAG_MAP: Record<string, string[]> = {
  containers: ["Storage", "Rental Opportunity", "Field Verify"],
  equipment: ["Heavy Equipment", "Active Project", "Construction Phase"],
  construction: ["Development", "Site Activity", "Market Signal"],
};

const NOTES_MAP: Record<DetectionCategory, string[]> = {
  "container-40ft": [
    "Standard 40' ISO container. Appears to be ground-level placement on gravel pad.",
    "40' container detected near loading dock. May be in active use for site storage.",
    "Single 40' unit visible. Condition appears good — no visible rust or damage.",
  ],
  "container-other": [
    "Smaller container detected — possibly 20' unit or custom size. Verify in field.",
    "Non-standard container near building entrance. Could be office conversion.",
  ],
  excavator: [
    "Track-mounted excavator visible near active trench line. Site appears mid-dig.",
    "Excavator parked near material pile. Possible shift break or staging.",
  ],
  bulldozer: [
    "Dozer tracks visible across cleared area. Active grading operation.",
    "Bulldozer staged near site entrance. Grading likely in progress.",
  ],
  crane: [
    "Mobile crane erected on-site. Indicates structural phase of construction.",
    "Crane boom visible — significant vertical construction underway.",
  ],
  "dump-truck": [
    "Dump truck near excavation area. Active earthmoving operation.",
    "Multiple dump truck tracks visible. High material movement volume.",
  ],
  "cleared-land": [
    "Recently cleared parcel — vegetation removed, bare soil visible. No structures yet.",
    "Large cleared area with perimeter fencing. Pre-construction staging likely.",
  ],
  "active-site": [
    "Multiple vehicles and equipment visible. Active construction with daily operations.",
    "Construction activity confirmed — temporary structures and equipment staging visible.",
  ],
  "foundation-work": [
    "Concrete foundation forms visible. Structural phase beginning.",
    "Foundation poured — rebar and form work visible from satellite imagery.",
  ],
  "material-staging": [
    "Palletized materials and lumber stacks detected near site perimeter.",
    "Open-air material storage area. Containers could protect high-value materials.",
  ],
};

/** Generate enriched detail data for a scan result */
export function getResultDetail(result: AreaScanResult): ResultDetail {
  const seed = result.id.charCodeAt(result.id.length - 1) + Math.round(result.lat * 1000);
  const rand = seededRand(seed);

  const conditions = CONDITION_LABELS[result.group] ?? CONDITION_LABELS.construction;
  const condition = conditions[Math.floor(rand() * conditions.length)];
  const action = ACTION_MAP[result.category];
  const notes = NOTES_MAP[result.category] ?? ["Detection confirmed via satellite imagery analysis."];

  const priority: "high" | "medium" | "low" =
    result.confidence > 0.88 ? "high" :
    result.confidence > 0.75 ? "medium" : "low";

  return {
    condition: condition.label,
    conditionColor: condition.color,
    estimatedSize: SIZE_MAP[result.category] ?? "Unknown",
    actionLabel: action.label,
    actionDescription: action.description,
    priority,
    tags: TAG_MAP[result.group] ?? [],
    notes: notes[Math.floor(rand() * notes.length)],
  };
}
