import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { OFFICE } from "../office";
import { opportunityTier } from "../scoring";
import type { CompanyRecord } from "../types";

type Props = {
  companies: (CompanyRecord & { distanceMi: number })[];
  origin: { lat: number; lng: number };
  selectedId?: string;
  onSelect: (id: string) => void;
};

function pinColor(score: number) {
  const t = opportunityTier(score);
  if (t === "high") return "#1f5c34";
  if (t === "medium") return "#b7791f";
  return "#6b7280";
}

export function MapView({ companies, origin, selectedId, onSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current, { zoomControl: false }).setView([origin.lat, origin.lng], 10);
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapObj.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapObj.current = null;
    };
  }, [origin.lat, origin.lng]);

  useEffect(() => {
    const map = mapObj.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const you = L.circleMarker([origin.lat, origin.lng], {
      radius: 9,
      color: "#0b1f14",
      weight: 2,
      fillColor: "#3d9a64",
      fillOpacity: 1,
    }).bindTooltip(origin.lat === OFFICE.lat ? "Office" : "You", { direction: "top" });
    layer.addLayer(you);

    for (const c of companies) {
      const selected = c.id === selectedId;
      const m = L.circleMarker([c.lat, c.lng], {
        radius: selected ? 11 : 8,
        color: selected ? "#0b1f14" : "#0f2f1c",
        weight: selected ? 3 : 1.5,
        fillColor: pinColor(c.opportunityScore),
        fillOpacity: 0.92,
      });
      m.bindTooltip(`${c.name} · ${c.opportunityScore}`, { direction: "top" });
      m.on("click", () => onSelect(c.id));
      layer.addLayer(m);
    }
  }, [companies, origin, selectedId, onSelect]);

  return <div className="map-canvas" ref={mapRef} />;
}
