import { useCallback, useEffect, useState } from "react";
import type { LatLng } from "@/lib/mapbox";

const STORAGE_KEY = "cliente_geo";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

type Stored = { lat: number; lng: number; ts: number };

export type GeoStatus = "idle" | "loading" | "ok" | "denied" | "unavailable";

function readStored(): LatLng | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Stored;
    if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
    if (Date.now() - (p.ts ?? 0) > MAX_AGE_MS) return null;
    return { lat: p.lat, lng: p.lng };
  } catch {
    return null;
  }
}

export function useGeoloc() {
  const [coords, setCoords] = useState<LatLng | null>(() => readStored());
  const [status, setStatus] = useState<GeoStatus>(() =>
    readStored() ? "ok" : "idle",
  );

  useEffect(() => {
    if (coords) return;
    const s = readStored();
    if (s) {
      setCoords(s);
      setStatus("ok");
    }
  }, [coords]);

  const pedir = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setStatus("ok");
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ ...c, ts: Date.now() } satisfies Stored),
          );
        } catch {
          /* ignore */
        }
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  const limpar = useCallback(() => {
    setCoords(null);
    setStatus("idle");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { coords, status, pedir, limpar };
}
