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
  const hasFitRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);

  // Resize fixes for mobile
  useEffect(() => {
    const onResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // Load locations
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

  // Convert to GeoJSON
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

  // Initialise map
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
          setError("Could not load roll-pin.png");
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
              "text-size": ["interpolate", ["linear"], ["zoom"], 10, 0, 12, 12, 14, 14],
              "text-anchor": "top",
              "text-offset": [0, 0.6],
            },
            paint: {
              "text-color": "#2c2c2c",
              "text-halo-color": "#facc00",
              "text-halo-width": 1.5,
            },
          });
        }

        // 🔥 AUTO-FIT MAP TO ALL PINS (ON FIRST LOAD)
        fitMapToPins(map, geojson.features);
        hasFitRef.current = true;

        map.on("click", "places-layer", (e) => {
          const f = e.features?.[0];
          if (!f) return;

          const [lng, lat] = (f.geometry as any).coordinates;
          const id = String((f.properties as any)?.id ?? "");
          if (!id) return;

          setSelected({
            id,
            name: (f.properties as any)?.name ?? "Untitled",
            description: (f.properties as any)?.description ?? "",
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

  // Update data + re-fit if needed
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const src = map.getSource("places") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData(geojson);

    if (!hasFitRef.current) {
      fitMapToPins(map, geojson.features);
      hasFitRef.current = true;
    }
  }, [geojson]);

  // When bottom sheet opens
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selected) {
      map.easeTo({
        center: [selected.lng, selected.lat],
        offset: [0, -120],
        duration: 450,
      });

      map.setPadding({
        top: 0,
        left: 0,
        right: 0,
        bottom: Math.round(window.innerHeight * 0.5),
      });
    } else {
      map.setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
    }
  }, [selected]);

  if (!token) {
    return <div style={{ padding: 16 }}>Missing Mapbox token</div>;
  }

  const rateUrl = selected ? `/add?locationId=${encodeURIComponent(selected.id)}` : "#";
  const reviewsUrl = selected ? `/place/${encodeURIComponent(selected.id)}` : "#";

  return (
    <main style={{ height: "100dvh", width: "100vw", position: "relative" }}>
      <div id="rrs-map" style={{ position: "absolute", inset: 0, touchAction: "none" }} />

      {selected && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "50dvh",
            background: "#fff",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: 14,
            boxShadow: "0 -12px 30px rgba(0,0,0,0.18)",
          }}
        >
          <strong>{selected.name}</strong>
          <p style={{ marginTop: 6 }}>{selected.description}</p>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <a href={rateUrl} style={{ flex: 1, background: "#111", color: "#fff", padding: 12, borderRadius: 14, textAlign: "center" }}>
              Rate
            </a>
            <a href={reviewsUrl} style={{ flex: 1, border: "1px solid #ddd", padding: 12, borderRadius: 14, textAlign: "center" }}>
              Reviews
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

/* ---------- helper ---------- */
function fitMapToPins(map: mapboxgl.Map, features: GeoJSON.Feature[]) {
  if (!features.length) return;

  if (features.length === 1) {
    const [lng, lat] = (features[0].geometry as any).coordinates;
    map.easeTo({ center: [lng, lat], zoom: 15, duration: 800 });
    return;
  }

  const bounds = new mapboxgl.LngLatBounds();
  features.forEach((f) => {
    const [lng, lat] = (f.geometry as any).coordinates;
    bounds.extend([lng, lat]);
  });

  map.fitBounds(bounds, {
    padding: { top: 80, bottom: 220, left: 60, right: 60 },
    duration: 800,
    maxZoom: 16,
  });
}
