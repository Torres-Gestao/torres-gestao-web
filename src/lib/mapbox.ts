// Helpers para geocoding via Mapbox e cálculo de distância.
// O token público (pk.*) é seguro no browser desde que restringido por
// allowlist de URLs no dashboard Mapbox.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface EnderecoGeocode {
  cep?: string;
  rua?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
}

const BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

function montarQuery(e: EnderecoGeocode): string {
  const partes = [
    [e.numero, e.rua].filter(Boolean).join(" "),
    e.cidade,
    e.uf,
    e.cep,
    "Brasil",
  ].filter((p) => p && String(p).trim().length > 0);
  return partes.join(", ");
}

export async function geocodeEndereco(
  token: string,
  end: EnderecoGeocode,
): Promise<LatLng | null> {
  const q = montarQuery(end);
  if (!q) return null;
  const url = `${BASE}/${encodeURIComponent(q)}.json?access_token=${token}&country=BR&limit=1&language=pt`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as { features?: Array<{ center?: [number, number] }> };
    const c = j.features?.[0]?.center;
    if (!c || c.length < 2) return null;
    return { lng: c[0], lat: c[1] };
  } catch {
    return null;
  }
}

export async function reverseGeocode(
  token: string,
  lat: number,
  lng: number,
): Promise<string | null> {
  const url = `${BASE}/${lng},${lat}.json?access_token=${token}&country=BR&limit=1&language=pt`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = (await r.json()) as { features?: Array<{ place_name?: string }> };
    return j.features?.[0]?.place_name ?? null;
  } catch {
    return null;
  }
}

// Distância em km entre dois pontos (fórmula de Haversine).
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // km
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
