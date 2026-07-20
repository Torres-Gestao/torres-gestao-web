import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { reverseGeocode } from "@/lib/mapbox";

interface Props {
  token: string;
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  brand?: string;
  helperText?: string;
}

export default function MapaConfirmacao({
  token,
  lat,
  lng,
  onChange,
  brand = "#6B21A8",
  helperText = "Arraste o pin até o local exato da entrega.",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [endereco, setEndereco] = useState<string | null>(null);

  // Inicializa o mapa uma vez.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: 16,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const marker = new mapboxgl.Marker({ color: brand, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);

    marker.on("dragend", () => {
      const { lng: newLng, lat: newLat } = marker.getLngLat();
      onChange(newLat, newLng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Sincroniza posição quando o pai muda (ex.: novo geocode).
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    markerRef.current.setLngLat([lng, lat]);
    mapRef.current.easeTo({ center: [lng, lat], duration: 400 });
  }, [lat, lng]);

  // Reverse geocode para exibir endereço formatado.
  useEffect(() => {
    let ativo = true;
    (async () => {
      const nome = await reverseGeocode(token, lat, lng);
      if (ativo) setEndereco(nome);
    })();
    return () => {
      ativo = false;
    };
  }, [lat, lng, token]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{helperText}</p>
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-lg border"
      />
      {endereco && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Local escolhido:</span> {endereco}
        </p>
      )}
    </div>
  );
}
