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

  // ✅ Active user location
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // ✅ Reactive dark-mode detection (doesn't get "stuck")
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setIsDark(mq.matches);
    update();

    if ((mq as any).addEventListener) (mq as any).addEventListener("change", update);
    else (mq as any).addListener(update);

    return () => {
      if ((mq as any).removeEventListener) (mq as any).removeEventListener("change", update);
      else (mq as any).removeListener(update);
    };
  }, []);

  // Mobile resize fixes
  useEffect(() => {
    const onResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // ✅ Watch user location
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation not supported on this device.");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        setGeoError(err.message || "Unable to get location.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 10_000,
      }
    );

    return () => navigator.geolocation.clearWatch(id);
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

  // ✅ Find nearest location to user
  const nearest = useMemo(() => {
    if (!userPos) return null;
    if (!locations.length) return null;

    let best: { loc: LocationRow; meters: number } | null = null;

    for (const loc of locations) {
      if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) continue;
      const m = haversineMeters(userPos.lat, userPos.lng, loc.lat, loc.lng);
      if (!best || m < best.meters) best = { loc, meters: m };
    }

    return best;
  }, [userPos, locations]);

  // Init map once
  useEffect(() => {
    if (!token) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = token;

    const darkNow =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const map = new mapboxgl.Map({
      container: "rrs-map",
      style: darkNow ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12",
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
            // ✅ Label contrast correct for dark map style
            paint: {
              "text-color": darkNow ? "#f8fafc" : "#2c2c2c",
              "text-halo-color": darkNow ? "rgba(0,0,0,0.70)" : "#facc00",
              "text-halo-width": 1.5,
            },
          });
        }

        // ✅ Auto-fit to show all pins on first load
        fitMapToPins(map, geojson.features);
        hasFitRef.current = true;

        // Click pin → open bottom sheet
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

  // Update source data when locations change + (optionally) fit once
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

  // When bottom sheet opens/closes, pad map + nudge selected pin above sheet
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
    return (
      <div style={{ padding: 16 }}>
        Missing <b>NEXT_PUBLIC_MAPBOX_TOKEN</b>. Add it in Vercel env vars too.
      </div>
    );
  }

  const rateUrl = selected ? `/add?locationId=${encodeURIComponent(selected.id)}` : "#";
  const reviewsUrl = selected ? `/place/${encodeURIComponent(selected.id)}` : "#";

  const nearestDirectionsUrl =
    nearest && userPos
      ? googleDirectionsUrl(userPos, { lat: nearest.loc.lat, lng: nearest.loc.lng })
      : "#";

  const selectedDirectionsUrl =
    selected && userPos ? googleDirectionsUrl(userPos, { lat: selected.lat, lng: selected.lng }) : "#";

  // ✅ Overlay theme (bulletproof even if CSS vars misbehave)
  const overlayBg = isDark ? "rgba(12, 18, 32, 0.94)" : "rgba(255,255,255,0.94)";
  const overlayText = isDark ? "#f8fafc" : "#111";
  const overlayBorder = isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.10)";
  const overlayShadow = isDark ? "0 10px 28px rgba(0,0,0,0.60)" : "0 6px 18px rgba(0,0,0,0.12)";

  const primaryBtn: React.CSSProperties = {
    textDecoration: "none",
    padding: "12px 12px",
    borderRadius: 14,
    background: overlayText, // invert
    color: isDark ? "#0b1220" : "#fff",
    fontWeight: 900,
    fontSize: 13,
    textAlign: "center",
    border: "1px solid rgba(0,0,0,0)",
  };

  const ghostBtn: React.CSSProperties = {
    textDecoration: "none",
    padding: "12px 12px",
    borderRadius: 14,
    border: overlayBorder,
    background: overlayBg,
    color: overlayText,
    fontWeight: 900,
    fontSize: 13,
    textAlign: "center",
    backdropFilter: "blur(6px)",
  };

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

      {/* ✅ Nearest roll chip (fixed contrast in dark mode) */}
      {nearest && userPos ? (
        <div
          style={{
            position: "fixed",
            top: "max(env(safe-area-inset-top), 8px)",
            left: 12,
            right: 12,
            zIndex: 10000,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              maxWidth: 520,
              width: "100%",
              background: overlayBg,
              color: overlayText,
              border: overlayBorder,
              borderRadius: 16,
              padding: "10px 12px",
              boxShadow: overlayShadow,
              backdropFilter: "blur(6px)",
              fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            }}
          >
            <div style={{ flex: 1, lineHeight: 1.1 }}>
              <div style={{ fontWeight: 900, fontSize: 12 }}>Nearest roll</div>
              <div style={{ fontSize: 13 }}>
                {nearest.loc.name} · <b>{formatDistance(nearest.meters)}</b>
              </div>
            </div>

            <a
              href={nearestDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              style={{ ...primaryBtn, padding: "8px 12px", borderRadius: 12, whiteSpace: "nowrap" }}
            >
              Directions
            </a>
          </div>
        </div>
      ) : null}

      {/* Optional: geolocation error */}
      {geoError ? (
        <div
          style={{
            position: "fixed",
            top: "max(env(safe-area-inset-top), 8px)",
            left: 12,
            zIndex: 10000,
            background: overlayBg,
            color: overlayText,
            border: overlayBorder,
            padding: "10px 12px",
            borderRadius: 14,
            boxShadow: overlayShadow,
            backdropFilter: "blur(6px)",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            fontSize: 12,
            pointerEvents: "none",
          }}
        >
          Location off: {geoError}
        </div>
      ) : null}

      {/* ✅ Add location button */}
      <a
        href="/add-location"
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 9999,
          pointerEvents: "auto",
          background: overlayText,
          color: isDark ? "#0b1220" : "#fff",
          padding: "12px 14px",
          borderRadius: 14,
          fontWeight: 800,
          textDecoration: "none",
          boxShadow: overlayShadow,
        }}
      >
        + Add a location
      </a>

      {/* ✅ Status overlay */}
      <div
        style={{
          position: "fixed",
          left: 12,
          bottom: 12,
          zIndex: 9999,
          pointerEvents: "none",
          background: overlayBg,
          border: overlayBorder,
          color: overlayText,
          borderRadius: 14,
          padding: "10px 12px",
          boxShadow: overlayShadow,
          backdropFilter: "blur(6px)",
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

      {/* ✅ Fixed bottom sheet */}
      {selected ? (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            height: "50dvh",
            zIndex: 10000,
            background: isDark ? "#0b1220" : "#fff",
            color: overlayText,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            boxShadow: isDark ? "0 -14px 34px rgba(0,0,0,0.65)" : "0 -12px 30px rgba(0,0,0,0.18)",
            borderTop: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.10)",
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
                border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.12)",
                background: isDark ? "#0f172a" : "#fff",
                color: overlayText,
                borderRadius: 12,
                padding: "8px 10px",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* ✅ Action row includes Directions */}
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <a href={rateUrl} style={{ ...primaryBtn, flex: 1 }}>
              Rate this roll
            </a>

            <a href={reviewsUrl} style={{ ...ghostBtn, flex: 1 }}>
              View reviews
            </a>

            <a href={selectedDirectionsUrl} target="_blank" rel="noreferrer" style={{ ...ghostBtn, flex: 1 }}>
              Directions
            </a>
          </div>

          {!userPos ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Enable location to get directions.
            </div>
          ) : null}

          <div style={{ marginTop: 14, fontSize: 12, opacity: 0.75 }}>
            Tip: zoom in to see nearby places, then tap another pin to switch.
          </div>
        </div>
      ) : null}
    </main>
  );
}

/* -------- helpers -------- */
function fitMapToPins(map: mapboxgl.Map, features: GeoJSON.Feature[]) {
  if (!features.length) return;

  if (features.length === 1) {
    const [lng, lat] = (features[0].geometry as any).coordinates;
    map.easeTo({ center: [lng, lat], zoom: 15, duration: 800 });
    return;
  }

  const bounds = new mapboxgl.LngLatBounds();
  for (const f of features) {
    const [lng, lat] = (f.geometry as any).coordinates;
    bounds.extend([lng, lat]);
  }

  map.fitBounds(bounds, {
    padding: { top: 80, bottom: 220, left: 60, right: 60 },
    duration: 800,
    maxZoom: 16,
  });
}

function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);

  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatDistance(meters: number) {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function googleDirectionsUrl(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=walking`;
}
