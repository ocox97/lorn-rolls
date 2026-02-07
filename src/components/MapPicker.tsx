"use client";

import { useEffect, useRef } from "react";

type LocationRow = {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  created_at: string;
};

export function MapPicker({
  token,
  locations,
  selected,
  onSelect,
}: {
  token: string;
  locations: LocationRow[];
  selected: { lat: number; lng: number } | null;
  onSelect: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const selectedMarkerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // init map once
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;

      mapboxgl.accessToken = token;

      if (cancelled) return;

      const map = new mapboxgl.Map({
        container: containerRef.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center: selected ? [selected.lng, selected.lat] : [-2.7, 56.223], // East Neuk-ish
        zoom: selected ? 13 : 11,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("click", (e: any) => {
        const lat = e.lngLat.lat;
        const lng = e.lngLat.lng;
        onSelect(lat, lng);
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      try {
        mapRef.current?.remove?.();
      } catch {}
      mapRef.current = null;
    };
  }, [token, onSelect, selected]);

  // update selected marker
  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      const mapboxgl = (await import("mapbox-gl")).default;

      // remove old
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.remove();
        selectedMarkerRef.current = null;
      }

      if (!selected) return;

      selectedMarkerRef.current = new mapboxgl.Marker({ color: "#000000" })
        .setLngLat([selected.lng, selected.lat])
        .addTo(mapRef.current);
    })();
  }, [selected]);

  // render markers for locations
  useEffect(() => {
    (async () => {
      if (!mapRef.current) return;
      const mapboxgl = (await import("mapbox-gl")).default;

      // clear existing
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      locations.forEach((loc) => {
        const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(
          `<div style="font-weight:600">${escapeHtml(loc.name)}</div>` +
            (loc.description ? `<div style="opacity:.8">${escapeHtml(loc.description)}</div>` : "")
        );

        const marker = new mapboxgl.Marker({ color: "#ffffff" })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(popup)
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      });
    })();
  }, [locations]);

  return (
    <div className="h-[360px] rounded-2xl overflow-hidden border border-slate-200">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

// tiny safety for popup text
function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
