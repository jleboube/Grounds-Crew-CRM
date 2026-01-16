
// Geocoding service - Google Maps (primary) with Nominatim fallback
// Google Maps has the most complete address database

import { StructuredAddress, formatFullAddress, DEFAULT_CITY, DEFAULT_STATE } from '../utils/addressUtils';

// Google Maps API Key - set in .env.local
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Re-export for convenience
export type { StructuredAddress };

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  confidence: 'high' | 'medium' | 'low';
  matchType: 'exact' | 'street' | 'city';
}

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
  full: string;
}

// Cache to avoid redundant geocoding requests
const geocodeCache: Map<string, GeocodingResult | null> = new Map();

// Rate limiting for Nominatim (fallback) - max 1 request per second
let lastNominatimRequest = 0;
const MIN_NOMINATIM_INTERVAL = 1100;

async function waitForNominatimRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastNominatimRequest;
  if (timeSinceLastRequest < MIN_NOMINATIM_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_NOMINATIM_INTERVAL - timeSinceLastRequest));
  }
  lastNominatimRequest = Date.now();
}

// Indiana bounding box for validation
const INDIANA_BOUNDS = {
  minLat: 37.7717,
  maxLat: 41.7613,
  minLng: -88.0979,
  maxLng: -84.7846
};

// Wider midwest bounds as fallback
const MIDWEST_BOUNDS = {
  minLat: 36.0,
  maxLat: 43.0,
  minLng: -92.0,
  maxLng: -82.0
};

function isInIndiana(lat: number, lng: number): boolean {
  return lat >= INDIANA_BOUNDS.minLat && lat <= INDIANA_BOUNDS.maxLat &&
         lng >= INDIANA_BOUNDS.minLng && lng <= INDIANA_BOUNDS.maxLng;
}

function isInMidwest(lat: number, lng: number): boolean {
  return lat >= MIDWEST_BOUNDS.minLat && lat <= MIDWEST_BOUNDS.maxLat &&
         lng >= MIDWEST_BOUNDS.minLng && lng <= MIDWEST_BOUNDS.maxLng;
}

/**
 * Parse an address string into components
 * Handles formats like:
 * - "123 Main St, Evansville, IN 47711"
 * - "123 Main St, Evansville, Indiana 47711"
 * - "123 Main St, Evansville, IN"
 */
export function parseAddress(address: string): AddressComponents {
  const trimmed = address.trim();

  // Extract ZIP code (5 digits, optionally with -4 extension)
  const zipMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch ? zipMatch[1] : '';

  // Remove ZIP from address for further parsing
  let remaining = trimmed.replace(/\b\d{5}(?:-\d{4})?\b/, '').trim();

  // Extract state (IN, Indiana, etc.)
  const statePatterns = [
    /,\s*(IN|Indiana)\s*$/i,
    /,\s*(IN|Indiana)\s*,/i,
    /\s+(IN|Indiana)\s*$/i,
  ];

  let state = 'Indiana'; // Default assumption
  for (const pattern of statePatterns) {
    const match = remaining.match(pattern);
    if (match) {
      state = match[1].length === 2 ? 'Indiana' : match[1];
      remaining = remaining.replace(pattern, ',').replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
      break;
    }
  }

  // Split remaining into parts by comma
  const parts = remaining.split(',').map(p => p.trim()).filter(p => p);

  let street = '';
  let city = '';

  if (parts.length >= 2) {
    street = parts[0];
    city = parts[1];
  } else if (parts.length === 1) {
    // Try to detect if it's just a street or has city embedded
    street = parts[0];
    city = 'Evansville'; // Default for this app
  }

  return {
    street,
    city,
    state,
    zip,
    full: trimmed
  };
}

/**
 * Google Maps Geocoding - Primary geocoding service (most accurate)
 * Returns coordinates or null if not found
 */
async function googleGeocode(address: string): Promise<GeocodingResult | null> {
  const encodedAddress = encodeURIComponent(address);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`;

  console.log(`[Geocode] Google Maps: ${address}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Geocode] Google HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log(`[Geocode] Google: ${data.status} - ${data.error_message || 'No results'}`);
      return null;
    }

    const result = data.results[0];
    const lat = result.geometry?.location?.lat;
    const lng = result.geometry?.location?.lng;

    if (!lat || !lng) {
      return null;
    }

    // Validate it's in Indiana
    if (!isInIndiana(lat, lng)) {
      console.log(`[Geocode] Google: Result not in Indiana (${lat}, ${lng})`);
      return null;
    }

    // Determine confidence based on location_type
    const locationType = result.geometry?.location_type;
    let confidence: 'high' | 'medium' | 'low' = 'high';
    let matchType: 'exact' | 'street' | 'city' = 'exact';

    if (locationType === 'ROOFTOP') {
      confidence = 'high';
      matchType = 'exact';
    } else if (locationType === 'RANGE_INTERPOLATED' || locationType === 'GEOMETRIC_CENTER') {
      confidence = 'medium';
      matchType = 'street';
    } else if (locationType === 'APPROXIMATE') {
      confidence = 'low';
      matchType = 'city';
    }

    console.log(`[Geocode] Google SUCCESS: ${result.formatted_address} (${locationType})`);
    return {
      latitude: lat,
      longitude: lng,
      displayName: result.formatted_address,
      confidence,
      matchType
    };
  } catch (error) {
    console.error(`[Geocode] Google error:`, error);
    return null;
  }
}

/**
 * Make a Nominatim API request (fallback)
 */
async function nominatimRequest(params: Record<string, string>): Promise<any[]> {
  await waitForNominatimRateLimit();

  const queryString = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: '5',
    ...params
  }).toString();

  const url = `https://nominatim.openstreetmap.org/search?${queryString}`;

  console.log(`[Geocode] Nominatim: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'GreenStateCRM/1.0 (lawn care route optimization)'
    }
  });

  if (!response.ok) {
    console.error(`[Geocode] Nominatim HTTP error: ${response.status}`);
    return [];
  }

  const data = await response.json();
  console.log(`[Geocode] Nominatim: ${data.length} results`);
  return data;
}

/**
 * Validate and score a geocoding result
 */
function scoreResult(result: any): number {
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);

  let score = 0;

  // Location scoring
  if (isInIndiana(lat, lng)) {
    score += 100;
  } else if (isInMidwest(lat, lng)) {
    score += 30;
  } else {
    score -= 100; // Heavily penalize non-midwest results
  }

  // Type scoring
  const type = result.type || '';
  const addressType = result.addresstype || '';

  if (type === 'house' || type === 'building' || addressType === 'place') {
    score += 50; // Exact address match
  } else if (type === 'street' || type === 'road' || addressType === 'road') {
    score += 30; // Street-level match
  } else if (type === 'city' || type === 'town' || addressType === 'city') {
    score += 10; // City-level match
  }

  // State verification bonus
  if (result.address?.state === 'Indiana') {
    score += 20;
  }

  return score;
}

/**
 * Select best result from candidates - STRICT: Only accept Indiana results
 */
function selectBestResult(results: any[]): { result: any; score: number } | null {
  if (!results || results.length === 0) return null;

  let best: any = null;
  let bestScore = -Infinity;

  for (const result of results) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // STRICT: Only accept results in Indiana - reject everything else
    if (!isInIndiana(lat, lng)) {
      console.log(`[Geocode] REJECTED (not in Indiana): ${result.display_name?.substring(0, 60)}...`);
      continue;
    }

    const score = scoreResult(result);
    console.log(`[Geocode] Score ${score} for: ${result.display_name?.substring(0, 50)}...`);

    if (score > bestScore) {
      bestScore = score;
      best = result;
    }
  }

  return best ? { result: best, score: bestScore } : null;
}

/**
 * Strategy 1: Structured query with all components
 * Uses state abbreviation "IN" instead of "Indiana" for better Nominatim results
 */
async function tryStructuredQuery(addr: AddressComponents): Promise<GeocodingResult | null> {
  if (!addr.street) return null;

  // Use "IN" abbreviation - Nominatim works better with abbreviated state names
  const stateAbbrev = addr.state === 'Indiana' ? 'IN' : addr.state;

  console.log(`[Geocode] Strategy 1: Structured query for "${addr.street}", ${addr.city || 'Evansville'}, ${stateAbbrev}`);

  const results = await nominatimRequest({
    street: addr.street,
    city: addr.city || 'Evansville',
    state: stateAbbrev || 'IN',
    country: 'USA'
  });

  const best = selectBestResult(results);
  if (best && best.score > 50) {
    const isExact = best.result.type === 'house' || best.result.type === 'building';
    return {
      latitude: parseFloat(best.result.lat),
      longitude: parseFloat(best.result.lon),
      displayName: best.result.display_name,
      confidence: isExact ? 'high' : 'medium',
      matchType: isExact ? 'exact' : 'street'
    };
  }

  return null;
}

/**
 * Strategy 2: Street name with ZIP code (good for finding the road)
 * Always includes "Evansville IN" to ensure Indiana results
 */
async function tryStreetWithZip(addr: AddressComponents): Promise<GeocodingResult | null> {
  if (!addr.street) return null;

  // Extract just the street name without house number for road-level match
  const streetName = addr.street.replace(/^\d+\s+/, '');
  const city = addr.city || 'Evansville';

  // Always include city and state to help Nominatim find Indiana results
  // ZIP code alone can be ambiguous
  const query = addr.zip
    ? `${streetName}, ${city}, IN ${addr.zip}`
    : `${streetName}, ${city}, Indiana`;

  console.log(`[Geocode] Strategy 2: Street+location query "${query}"`);

  const results = await nominatimRequest({
    q: query,
    countrycodes: 'us'
  });

  const best = selectBestResult(results);
  if (best && best.score > 30) {
    return {
      latitude: parseFloat(best.result.lat),
      longitude: parseFloat(best.result.lon),
      displayName: best.result.display_name,
      confidence: 'medium',
      matchType: 'street'
    };
  }

  return null;
}

/**
 * Strategy 3: City-level fallback
 */
async function tryCityFallback(addr: AddressComponents): Promise<GeocodingResult | null> {
  const city = addr.city || 'Evansville';
  const query = `${city}, Indiana, USA`;

  console.log(`[Geocode] Strategy 3: City fallback "${query}"`);

  const results = await nominatimRequest({
    q: query,
    countrycodes: 'us'
  });

  const best = selectBestResult(results);
  if (best) {
    return {
      latitude: parseFloat(best.result.lat),
      longitude: parseFloat(best.result.lon),
      displayName: best.result.display_name,
      confidence: 'low',
      matchType: 'city'
    };
  }

  return null;
}

/**
 * Main geocoding function with multi-strategy fallback
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const cacheKey = address.toLowerCase().trim();

  // Check cache
  if (geocodeCache.has(cacheKey)) {
    console.log(`[Geocode] Cache hit for "${address}"`);
    return geocodeCache.get(cacheKey) || null;
  }

  console.log(`[Geocode] Starting geocode for: "${address}"`);

  try {
    const parsed = parseAddress(address);
    console.log(`[Geocode] Parsed: street="${parsed.street}", city="${parsed.city}", state="${parsed.state}", zip="${parsed.zip}"`);

    // Strategy 1: Structured query
    let result = await tryStructuredQuery(parsed);
    if (result) {
      console.log(`[Geocode] SUCCESS via structured query: ${result.confidence} confidence`);
      geocodeCache.set(cacheKey, result);
      return result;
    }

    // Strategy 2: Street with ZIP
    result = await tryStreetWithZip(parsed);
    if (result) {
      console.log(`[Geocode] SUCCESS via street+ZIP: ${result.confidence} confidence`);
      geocodeCache.set(cacheKey, result);
      return result;
    }

    // Strategy 3: City fallback (last resort for route planning)
    result = await tryCityFallback(parsed);
    if (result) {
      console.log(`[Geocode] SUCCESS via city fallback: ${result.confidence} confidence`);
      geocodeCache.set(cacheKey, result);
      return result;
    }

    console.warn(`[Geocode] FAILED: No valid results for "${address}"`);
    geocodeCache.set(cacheKey, null);
    return null;

  } catch (error) {
    console.error(`[Geocode] ERROR for "${address}":`, error);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Clear the geocoding cache
 */
export function clearGeocodingCache(): void {
  geocodeCache.clear();
  console.log('[Geocode] Cache cleared');
}

/**
 * Batch geocode multiple addresses with progress callback
 */
export async function batchGeocode(
  addresses: string[],
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<Map<string, GeocodingResult | null>> {
  const results = new Map<string, GeocodingResult | null>();

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    onProgress?.(i, addresses.length, addr);

    const result = await geocodeAddress(addr);
    results.set(addr, result);
  }

  onProgress?.(addresses.length, addresses.length, 'Complete');
  return results;
}

// ============== Route Optimization Functions ==============

export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(deg: number): number {
  return deg * (Math.PI / 180);
}

export function calculateTotalRouteDistance(
  coordinates: { lat: number; lng: number }[]
): number {
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += calculateDistance(
      coordinates[i].lat, coordinates[i].lng,
      coordinates[i + 1].lat, coordinates[i + 1].lng
    );
  }
  return total;
}

/**
 * Nearest Neighbor algorithm for initial route
 */
export function optimizeRouteOrder<T extends { id: string; lat: number; lng: number }>(
  customers: T[]
): string[] {
  if (customers.length <= 2) return customers.map(c => c.id);

  const remaining = [...customers];
  const route: T[] = [remaining.shift()!];

  while (remaining.length > 0) {
    const last = route[route.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = calculateDistance(last.lat, last.lng, remaining[i].lat, remaining[i].lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    route.push(remaining.splice(nearestIdx, 1)[0]);
  }

  return route.map(c => c.id);
}

/**
 * 2-opt improvement
 */
export function improveRouteWith2Opt<T extends { id: string; lat: number; lng: number }>(
  customers: T[],
  initialOrder: string[]
): string[] {
  if (customers.length <= 3) return initialOrder;

  const customerMap = new Map(customers.map(c => [c.id, c]));
  let route = initialOrder.map(id => customerMap.get(id)!).filter(Boolean);

  let improved = true;
  let iterations = 0;

  while (improved && iterations < 100) {
    improved = false;
    iterations++;

    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length; j++) {
        const d1 = calculateDistance(route[i].lat, route[i].lng, route[i + 1].lat, route[i + 1].lng);
        const d2 = j + 1 < route.length
          ? calculateDistance(route[j].lat, route[j].lng, route[j + 1].lat, route[j + 1].lng)
          : 0;
        const d3 = calculateDistance(route[i].lat, route[i].lng, route[j].lat, route[j].lng);
        const d4 = j + 1 < route.length
          ? calculateDistance(route[i + 1].lat, route[i + 1].lng, route[j + 1].lat, route[j + 1].lng)
          : 0;

        if (d3 + d4 < d1 + d2) {
          route = [
            ...route.slice(0, i + 1),
            ...route.slice(i + 1, j + 1).reverse(),
            ...route.slice(j + 1)
          ];
          improved = true;
        }
      }
    }
  }

  return route.map(c => c.id);
}

/**
 * Full optimization: Nearest Neighbor + 2-opt
 */
export function fullyOptimizeRoute<T extends { id: string; lat: number; lng: number }>(
  customers: T[]
): { order: string[]; distance: number; savings: number } {
  if (customers.length <= 1) {
    return { order: customers.map(c => c.id), distance: 0, savings: 0 };
  }

  const originalDistance = calculateTotalRouteDistance(
    customers.map(c => ({ lat: c.lat, lng: c.lng }))
  );

  const nnOrder = optimizeRouteOrder(customers);
  const optimizedOrder = improveRouteWith2Opt(customers, nnOrder);

  const customerMap = new Map(customers.map(c => [c.id, c]));
  const optimizedCustomers = optimizedOrder.map(id => customerMap.get(id)!);
  const optimizedDistance = calculateTotalRouteDistance(
    optimizedCustomers.map(c => ({ lat: c.lat, lng: c.lng }))
  );

  return {
    order: optimizedOrder,
    distance: optimizedDistance,
    savings: Math.max(0, originalDistance - optimizedDistance)
  };
}

// ============== Structured Address Geocoding ==============

/**
 * Geocode a structured address directly (no parsing needed)
 * Uses Google Maps (primary) with Nominatim fallback
 */
export async function geocodeStructuredAddress(
  address: StructuredAddress
): Promise<GeocodingResult | null> {
  // Create full address for cache key and logging
  const fullAddress = formatFullAddress(address);
  const cacheKey = fullAddress.toLowerCase().trim();

  // Check cache
  if (geocodeCache.has(cacheKey)) {
    console.log(`[Geocode] Cache hit for "${fullAddress}"`);
    return geocodeCache.get(cacheKey) || null;
  }

  console.log(`[Geocode] Geocoding: "${fullAddress}"`);

  try {
    const city = address.city || DEFAULT_CITY;
    const state = address.state || DEFAULT_STATE;
    const stateAbbrev = state === 'Indiana' ? 'IN' : state === 'Illinois' ? 'IL' : state === 'Kentucky' ? 'KY' : state === 'Ohio' ? 'OH' : state === 'Michigan' ? 'MI' : state;

    // Format for Google: "Street, City, State ZIP"
    const googleAddress = `${address.street}, ${city}, ${stateAbbrev} ${address.zip || ''}`.trim();

    // PRIMARY: Google Maps Geocoding (most accurate)
    let result = await googleGeocode(googleAddress);
    if (result) {
      geocodeCache.set(cacheKey, result);
      return result;
    }

    // FALLBACK: Nominatim (free, in case Google fails)
    const components: AddressComponents = {
      street: address.street,
      city: city,
      state: state,
      zip: address.zip || '',
      full: fullAddress
    };

    result = await tryStructuredQuery(components);
    if (result) {
      console.log(`[Geocode] SUCCESS via Nominatim: ${result.confidence}`);
      geocodeCache.set(cacheKey, result);
      return result;
    }

    // City-level fallback
    result = await tryCityFallback(components);
    if (result) {
      console.log(`[Geocode] SUCCESS via city fallback: ${result.confidence}`);
      geocodeCache.set(cacheKey, result);
      return result;
    }

    console.warn(`[Geocode] FAILED: No results for "${fullAddress}"`);
    geocodeCache.set(cacheKey, null);
    return null;

  } catch (error) {
    console.error(`[Geocode] ERROR for "${fullAddress}":`, error);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Batch geocode multiple structured addresses with progress callback
 */
export async function batchGeocodeStructured(
  addresses: StructuredAddress[],
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<Map<string, GeocodingResult | null>> {
  const results = new Map<string, GeocodingResult | null>();

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    const key = formatFullAddress(addr);
    onProgress?.(i, addresses.length, key);

    const result = await geocodeStructuredAddress(addr);
    results.set(key, result);
  }

  onProgress?.(addresses.length, addresses.length, 'Complete');
  return results;
}
