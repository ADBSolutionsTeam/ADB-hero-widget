import { Business, ContainerDetection } from "./types";

const SATELLITE_IMAGES = [
  "/satellite/site-1.jpg",
  "/satellite/site-2.jpg",
  "/satellite/site-3.jpg",
  "/satellite/site-4.jpg",
  "/satellite/site-5.jpg",
  "/satellite/site-6.jpg",
];

const CONSTRUCTION_PHASES = [
  "Excavation",
  "Foundation",
  "Framing",
  "Active Build",
  "Site Prep",
  "Renovation",
];

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807) % 2147483647;
    return (hash & 0x7fffffff) / 0x7fffffff;
  };
}

function generateDetections(rand: () => number): ContainerDetection[] {
  const count = Math.floor(rand() * 5);
  const detections: ContainerDetection[] = [];

  for (let i = 0; i < count; i++) {
    const isTrailer = rand() > 0.75;
    const type = isTrailer ? "trailer" : rand() > 0.5 ? "40ft" : "other";
    const confidence = 0.35 + rand() * 0.6;

    detections.push({
      type,
      confidence: Math.round(confidence * 100) / 100,
      x: 50 + Math.floor(rand() * 300),
      y: 50 + Math.floor(rand() * 200),
      width: type === "40ft" ? 120 : type === "other" ? 80 : 100,
      height: type === "40ft" ? 35 : type === "other" ? 30 : 28,
      excluded: isTrailer,
    });
  }

  return detections;
}

export function processBusinesses(businesses: Business[]): Business[] {
  return businesses.map((biz, index) => {
    const rand = seededRandom(biz.name + biz.address);

    const detections = generateDetections(rand);
    const validDetections = detections.filter(
      (d) => !d.excluded && d.confidence >= 0.45
    );
    const containerCount = validDetections.length;

    const avgConfidence =
      validDetections.length > 0
        ? validDetections.reduce((sum, d) => sum + d.confidence, 0) /
          validDetections.length
        : 0;

    let status: Business["status"];
    if (containerCount === 0) status = "clear";
    else if (avgConfidence > 0.9) status = "confirmed";
    else if (avgConfidence >= 0.45) status = "review";
    else status = "clear";

    const constructionScore = Math.floor(rand() * 100);
    const opportunityScore = Math.floor(
      constructionScore * 0.6 + containerCount * 15 + rand() * 20
    );

    const demandOptions = [
      "1-2 containers",
      "2-4 containers",
      "3-6 containers",
      "4-8 containers",
    ];

    return {
      ...biz,
      lat: 33.4 + rand() * 0.3,
      lng: -(111.8 + rand() * 0.4),
      containersDetected: containerCount,
      containerDetails: detections,
      confidence: Math.round(avgConfidence * 100) / 100,
      status,
      satelliteImage: SATELLITE_IMAGES[index % SATELLITE_IMAGES.length],
      constructionScore: Math.min(constructionScore, 100),
      opportunityScore: Math.min(opportunityScore, 100),
      estimatedDemand: containerCount > 0 ? demandOptions[Math.min(containerCount - 1, 3)] : "None",
      constructionPhase:
        constructionScore > 40
          ? CONSTRUCTION_PHASES[Math.floor(rand() * CONSTRUCTION_PHASES.length)]
          : undefined,
    };
  });
}

export function parseCSV(text: string): Business[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const nameIdx = headers.findIndex((h) =>
    h.includes("name") || h.includes("business")
  );
  const addressIdx = headers.findIndex((h) =>
    h.includes("address") || h.includes("street")
  );
  const cityIdx = headers.findIndex((h) => h.includes("city"));
  const stateIdx = headers.findIndex((h) => h.includes("state"));
  const zipIdx = headers.findIndex((h) =>
    h.includes("zip") || h.includes("postal")
  );

  return lines.slice(1).filter(line => line.trim()).map((line, i) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      id: `biz-${i}`,
      name: nameIdx >= 0 ? cols[nameIdx] : `Business ${i + 1}`,
      address: addressIdx >= 0 ? cols[addressIdx] : "",
      city: cityIdx >= 0 ? cols[cityIdx] : "",
      state: stateIdx >= 0 ? cols[stateIdx] : "",
      zip: zipIdx >= 0 ? cols[zipIdx] : "",
      status: "pending" as const,
    };
  });
}

export function exportToCSV(businesses: Business[]): string {
  const headers = [
    "Business Name",
    "Address",
    "City",
    "State",
    "Zip",
    "Containers Detected",
    "Confidence",
    "Status",
    "Construction Score",
    "Opportunity Score",
    "Estimated Demand",
    "Construction Phase",
  ];

  const rows = businesses.map((b) => [
    b.name,
    b.address,
    b.city,
    b.state,
    b.zip,
    b.containersDetected ?? 0,
    b.confidence ? `${Math.round(b.confidence * 100)}%` : "N/A",
    b.status ?? "pending",
    b.constructionScore ?? 0,
    b.opportunityScore ?? 0,
    b.estimatedDemand ?? "None",
    b.constructionPhase ?? "N/A",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export const SAMPLE_BUSINESSES: Business[] = [
  { id: "1", name: "Phoenix Industrial Supply Co", address: "1800 W Industrial Ave", city: "Phoenix", state: "AZ", zip: "85009" },
  { id: "2", name: "Desert Ridge Construction", address: "4525 E Baseline Rd", city: "Mesa", state: "AZ", zip: "85206" },
  { id: "3", name: "Copper State Logistics", address: "901 N 75th Ave", city: "Phoenix", state: "AZ", zip: "85043" },
  { id: "4", name: "Southwest Building Materials", address: "2200 S 7th St", city: "Phoenix", state: "AZ", zip: "85034" },
  { id: "5", name: "Valley Freight & Storage", address: "6789 W Buckeye Rd", city: "Phoenix", state: "AZ", zip: "85043" },
  { id: "6", name: "Sonoran Equipment Rentals", address: "3100 N 33rd Ave", city: "Phoenix", state: "AZ", zip: "85017" },
  { id: "7", name: "Maricopa Steel Works", address: "410 S 51st Ave", city: "Phoenix", state: "AZ", zip: "85043" },
  { id: "8", name: "Cactus Valley Plumbing HQ", address: "1555 E University Dr", city: "Tempe", state: "AZ", zip: "85281" },
];
