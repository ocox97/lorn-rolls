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

type SelectedPlace = {
  id: string;
  name: string;
  description: string;
  lng: number;
  lat: number;
};

export default function MapPage() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);

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
            coordinates: [l.lng, l.lat],
          },
        })),
    };
  }, [locations]);

  // 3) Initialise map ONCE
  useEffect(() => {
    if (!token) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: "rrs-map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-2.7, 56.223],
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

        // ✅ Click pin → open fixed bottom sheet (NOT a map popup)
        map.on("click", "places-layer", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;

          const coords = (feature.geometry as any).coordinates.slice();
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);

          const rawId = (feature.properties as any)?.id;
          const id = typeof rawId === "string" ? rawId : String(rawId ?? "");

          if (!id || id === "undefined" || id === "null") {
            setError("This pin has no valid id (cannot open reviews).");
            return;
          }

          const name = (feature.properties as any)?.name ?? "Untitled";
          const desc = (feature.properties as any)?.description ?? "";

          setSelected({
            id,
            name,
            description: desc,
            lng,
            lat,
          });
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
      map.remove();
      mapRef.current = null;
    };
  }, [token, geojson]);

  // 4) Update source data when locations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("places") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(geojson);
  }, [geojson]);

  // ✅ When bottom sheet opens/closes, add map padding so pins aren't hidden behind it
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selected) {
      map.easeTo({
        center: [selected.lng, selected.lat],
        // a small vertical offset so the pin sits above the sheet
        offset: [0, -120],
        duration: 450,
      });

      map.setPadding({ top: 0, left: 0, right: 0, bottom: Math.round(window.innerHeight * 0.5) });
    } else {
      map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
    }
  }, [selected]);

  if (!token) {
    return (
      <div style={{ padding: 16 }}>
        Missing <b>NEXT_PUBLIC_MAPBOX_TOKEN</b> in <b>.env.local</b>. Restart{" "}
        <b>npm run dev</b> after adding it.
      </div>
    );
  }

  const rateUrl = selected ? `/add?locationId=${encodeURIComponent(selected.id)}` : "#";
  const reviewsUrl = selected ? `/place/${encodeURIComponent(selected.id)}` : "#";

  return (
    <main style={{ height: "100dvh", width: "100vw", position: "relative" }}>
      {/* Full screen map */}
      <div
        id="rrs-map"
        style={{
          position: "absolute",
          inset: 0,
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

      {/* Status overlay */}
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

      {/* ✅ Fixed bottom sheet (only when a place is selected) */}
      {selected ? (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            height: "50dvh", // 👈 bottom half of the screen
            zIndex: 10000,
            background: "rgba(255,255,255,0.98)",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            boxShadow: "0 -12px 30px rgba(0,0,0,0.18)",
            borderTop: "1px solid rgba(0,0,0,0.08)",
            padding: 14,
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
            pointerEvents: "auto",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{selected.name}</div>
              {selected.description ? (
                <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>{selected.description}</div>
              ) : null}
            </div>

            <button
              onClick={() => setSelected(null)}
              style={{
                border: "1px solid rgba(0,0,0,0.15)",
                background: "#fff",
                borderRadius: 12,
                padding: "8px 10px",
                fontWeight: 800,
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <a
              href={rateUrl}
              style={{
                flex: 1,
                textDecoration: "none",
                padding: "12px 12px",
                borderRadius: 14,
                background: "#111",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              Rate this roll
            </a>

            <a
              href={reviewsUrl}
              style={{
                flex: 1,
                textDecoration: "none",
                padding: "12px 12px",
                borderRadius: 14,
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
                fontWeight: 800,
                fontSize: 13,
                textAlign: "center",
              }}
            >
              View reviews
            </a>
          </div>

          {/* Optional extra space / future content */}
          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
            Tip: zoom in to see nearby places, then tap another pin to switch.
          </div>
        </div>
      ) : null}
    </main>
  );
}
