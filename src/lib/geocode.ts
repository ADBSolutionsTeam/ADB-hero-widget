import { Business } from "./types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface MapboxFeature {
  center: [number, number]; // [lng, lat]
  place_name: string;
  relevance: number;
}

interface MapboxGeocodeResponse {
  features: MapboxFeature[];
}

/**
 * Geocode a single address using the Mapbox Geocoding API.
 * Returns [lat, lng] or null if no result / no token.
 */
export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN) return null;

  const query = encodeURIComponent(
    [address, city, state, zip].filter(Boolean).join(", ")
  );

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&country=US&limit=1&types=address,poi`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data: MapboxGeocodeResponse = await res.json();
    if (data.features.length === 0) return null;

    const [lng, lat] = data.features[0].center;
    return { lat, lng };
  } catch {
    return null;
  }
}

/**
 * Geocode an array of businesses using Mapbox, with a small delay
 * between requests to respect rate limits. Skips businesses that
 * already have lat/lng. Falls back to the existing seeded-random
 * coordinates when the token is missing.
 */
export async function geocodeBusinesses(
  businesses: Business[],
  onProgress?: (completed: number, total: number) => void
): Promise<Business[]> {
  if (!MAPBOX_TOKEN) return businesses;

  const total = businesses.filter((b) => !b.lat || !b.lng).length;
  let completed = 0;

  const results: Business[] = [];

  for (const biz of businesses) {
    if (biz.lat && biz.lng) {
      results.push(biz);
      continue;
    }

    const coords = await geocodeAddress(
      biz.address,
      biz.city,
      biz.state,
      biz.zip
    );

    completed++;
    onProgress?.(completed, total);

    if (coords) {
      results.push({ ...biz, lat: coords.lat, lng: coords.lng });
    } else {
      results.push(biz);
    }

    // Small delay to respect Mapbox rate limits (600 req/min for free tier)
    if (completed < total) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return results;
}
