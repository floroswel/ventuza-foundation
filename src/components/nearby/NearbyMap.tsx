import { useEffect, useRef } from "react";
import maplibregl, { Map as MlMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { NearbyPoint } from "@/lib/nearby.functions";
import type { Coords } from "@/lib/geo-bucket";

type Props = {
  user: Coords | null;
  points: (NearbyPoint & { distanceM: number })[];
  onSelect: (p: NearbyPoint) => void;
};

// OpenStreetMap raster style — no API key, no SDK telemetry.
// Subprocessor: OpenStreetMap Foundation (UK). Disclosed in legal/subprocessors.
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function NearbyMap({ user, points, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = user
      ? [user.lng, user.lat]
      : [26.1025, 44.4268]; // București fallback
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center,
      zoom: 13,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // user pin
  const userMarkerRef = useRef<Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !user) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([user.lng, user.lat]);
    } else {
      const el = document.createElement("div");
      el.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:hsl(var(--primary));box-shadow:0 0 0 4px hsla(var(--primary)/0.25);border:2px solid white;";
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([user.lng, user.lat])
        .addTo(map);
      map.flyTo({ center: [user.lng, user.lat], zoom: 14, duration: 600 });
    }
  }, [user]);

  // point pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    for (const p of points) {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", p.name);
      const color =
        p.kind === "event"
          ? "hsl(var(--accent))"
          : p.kind === "offer"
          ? "hsl(var(--destructive))"
          : "hsl(var(--secondary))";
      el.style.cssText = `width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;`;
      el.innerHTML = `<span style="transform:rotate(45deg);font-size:12px;color:white;font-weight:700;">${p.kind === "event" ? "E" : p.kind === "offer" ? "%" : "•"}</span>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect(p);
      });
      const m = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markersRef.current.push(m);
    }
  }, [points, onSelect]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[60vh] rounded-lg overflow-hidden border border-border"
    />
  );
}
