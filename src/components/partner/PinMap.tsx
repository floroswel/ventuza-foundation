import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Props = {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  helper?: boolean;
};

/**
 * Shared draggable pin map used by partner venue dialog and PostingWizard.
 * Lives in its own module so `maplibre-gl` (~1MB gzip 300k) is only pulled
 * into the bundle when the map dialog actually opens (React.lazy).
 */
export default function PinMap({ lat, lng, onChange, helper = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [lng, lat],
      zoom: 13,
    });
    mapRef.current = map;
    const marker = new maplibregl.Marker({ color: "#dc2626", draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      onChange(p.lat, p.lng);
    });
    map.on("click", (e) => {
      marker.setLngLat([e.lngLat.lng, e.lngLat.lat]);
      onChange(e.lngLat.lat, e.lngLat.lng);
    });
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (markerRef.current) markerRef.current.setLngLat([lng, lat]);
  }, [lat, lng]);

  if (helper) {
    return (
      <div className="space-y-1">
        <div ref={ref} className="w-full h-56 rounded border" />
        <div className="text-xs text-muted-foreground">
          Click pe hartă sau trage pin-ul pentru a seta locația.
        </div>
      </div>
    );
  }
  return <div ref={ref} className="w-full h-56 rounded border" />;
}
