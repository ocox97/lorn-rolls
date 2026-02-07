"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  created_at: string;
};

type GeoJsonFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, any>;

export default function MapPage() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  // ✅ Mobile fixes: ensure map resizes properly on viewport/orientation changes
  useEffect(() => {
    const onResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // 1) Load locations from Supabase
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("locations")
        .select("id,name,description,lat,lng,created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLocations([]);
      } else {
        setLocations((data ?? []) as LocationRow[]);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Convert to GeoJSON for Mapbox source
  const geojson: GeoJsonFeatureCollection = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: locations
        .filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng))
        .map((l) => ({
          type: "Feature",
          properties: {
            id: l.id,
            name: l.name,
            description: l.description ?? "",
          },
          geometry: {
            type: "Point",
            coordinates: [l.lng, l.lat], // IMPORTANT: [LNG, LAT]
          },
        })),
    };
  }, [locations]);

  // 3) Initialise map ONCE
  useEffect(() => {
    if (!token) return;
    if (mapRef.current) return; // already created

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: "rrs-map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-2.7, 56.223], // East Neuk-ish
      zoom: 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.loadImage("/roll-pin.png", (err, image) => {
        if (err || !image) {
          console.error("Failed to load /roll-pin.png", err);
          setError("Could not load roll-pin.png. Check /public/roll-pin.png");
          return;
        }

        if (!map.hasImage("roll-pin")) {
          map.addImage("roll-pin", image);
        }

        if (!map.getSource("places")) {
          map.addSource("places", {
            type: "geojson",
            data: geojson,
          });
        }

        if (!map.getLayer("places-layer")) {
          map.addLayer({
            id: "places-layer",
            type: "symbol",
            source: "places",
            layout: {
              "icon-image": "roll-pin",
              "icon-size": 0.8,
              "icon-anchor": "bottom",
              "icon-allow-overlap": true,

              "text-field": ["get", "name"],
              "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
              "text-size": ["interpolate", ["linear"], ["zoom"], 10, 0, 12, 12, 14, 14],
              "text-anchor": "top",
              "text-offset": [0, 0.6],
              "text-allow-overlap": false,
            },
            paint: {
              "text-color": "#2c2c2c",
              "text-halo-color": "#facc00",
              "text-halo-width": 1.5,
            },
          });
        }

        map.on("click", "places-layer", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const coords = (feature.geometry as any).coordinates.slice();

          const rawId = (feature.properties as any)?.id;
          const id = typeof rawId === "string" ? rawId : String(rawId ?? "");

          if (!id || id === "undefined" || id === "null") {
            setError("This pin has no valid id (cannot open reviews).");
            return;
          }

          const name = (feature.properties as any)?.name ?? "Untitled";
          const desc = (feature.properties as any)?.description ?? "";

          popupRef.current?.remove();

          const rateUrl = `/add?locationId=${encodeURIComponent(id)}`;
          const reviewsUrl = `/place/${encodeURIComponent(id)}`;

          const html =
            `<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; min-width: 220px;">` +
            `<div style="font-weight:700; font-size: 14px;">${escapeHtml(name)}</div>` +
            (desc
              ? `<div style="opacity:.8; margin-top: 4px; font-size: 13px;">${escapeHtml(desc)}</div>`
              : "") +
            `<div style="display:flex; gap:8px; margin-top: 10px;">` +
            `<a href="${rateUrl}" style="text-decoration:none; padding:8px 10px; border-radius:10px; background:#111; color:#fff; font-weight:700; font-size:12px;">Rate this roll</a>` +
            `<a href="${reviewsUrl}" style="text-decoration:none; padding:8px 10px; border-radius:10px; border:1px solid #ddd; background:#fff; color:#111; font-weight:700; font-size:12px;">View reviews</a>` +
            `</div>` +
            `</div>`;

          // ✅ Mobile: slightly bigger offset makes popups easier to tap
          const popup = new mapboxgl.Popup({ offset: 28 })
            .setLngLat(coords)
            .setHTML(html)
            .addTo(map);

          popupRef.current = popup;
        });

        map.on("mouseenter", "places-layer", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "places-layer", () => {
          map.getCanvas().style.cursor = "";
        });
      });
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // NOTE: keep this as-is since it's your current pattern, but removing geojson here is also fine.
  }, [token, geojson]);

  // 4) Update source data when locations change (no reinit)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("places") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(geojson);
  }, [geojson]);

  if (!token) {
    return (
      <div style={{ padding: 16 }}>
        Missing <b>NEXT_PUBLIC_MAPBOX_TOKEN</b> in <b>.env.local</b>. Restart{" "}
        <b>npm run dev</b> after adding it.
      </div>
    );
  }

  return (
    // ✅ Mobile: use dynamic viewport height to reduce iOS/Android address bar jump
    <main style={{ height: "100dvh", width: "100vw", position: "relative" }}>
      {/* Full screen map (absolute) */}
      <div
        id="rrs-map"
        style={{
          position: "absolute",
          inset: 0,
          // ✅ Mobile: prevents page scroll fighting map gestures
          touchAction: "none",
        }}
      />

      {/* Add location button */}
      <a
        href="/add-location"
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 9999,
          pointerEvents: "auto",
          background: "#111",
          color: "#fff",
          padding: "12px 14px",
          borderRadius: 14,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
      >
        + Add a location
      </a>

      {/* Status overlay (doesn't block clicks) */}
      <div
        style={{
          position: "fixed",
          left: 12,
          bottom: 12,
          zIndex: 9999,
          pointerEvents: "none",
          background: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 14,
          padding: "10px 12px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          fontSize: 12,
          maxWidth: 320,
        }}
      >
        {error ? (
          <div style={{ color: "#b00020", fontWeight: 700 }}>Error: {error}</div>
        ) : loading ? (
          <div style={{ opacity: 0.8 }}>Loading locations…</div>
        ) : (
          <div style={{ opacity: 0.8 }}>{locations.length} locations</div>
        )}
      </div>
    </main>
  );
}

function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
