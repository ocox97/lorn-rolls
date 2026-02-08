"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/lib/supabaseClient";

type GeoJsonFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point, any>;

export default function AddLocationPage() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // GeoJSON for the selected pin (so we can render it as a Mapbox symbol layer)
  const selectedGeojson: GeoJsonFeatureCollection = useMemo(() => {
    if (lat == null || lng == null) {
      return { type: "FeatureCollection", features: [] };
    }
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
        },
      ],
    };
  }, [lat, lng]);

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

  useEffect(() => {
    if (!token) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: "add-map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-2.7, 56.223],
      zoom: 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Load the same pin image you use on /map
      map.loadImage("/roll-pin.png", (err, image) => {
        if (err || !image) {
          console.error("Failed to load /roll-pin.png", err);
          setError("Could not load roll-pin.png. Check /public/roll-pin.png");
          return;
        }

        if (!map.hasImage("roll-pin")) {
          map.addImage("roll-pin", image);
        }

        // Source for the selected pin
        if (!map.getSource("selected-pin")) {
          map.addSource("selected-pin", {
            type: "geojson",
            data: selectedGeojson,
          });
        }

        // Layer to render the selected pin
        if (!map.getLayer("selected-pin-layer")) {
          map.addLayer({
            id: "selected-pin-layer",
            type: "symbol",
            source: "selected-pin",
            layout: {
              "icon-image": "roll-pin",
              "icon-size": 0.9,
              "icon-anchor": "bottom",
              "icon-allow-overlap": true,
            },
          });
        }
      });

      // Click map = set pin coords
      map.on("click", (e) => {
        const { lng, lat } = e.lngLat;
        setLng(lng);
        setLat(lat);

        // Optional: gentle ease so it feels intentional
        map.easeTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 15),
          duration: 450,
        });
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, selectedGeojson]);

  // Whenever lat/lng changes, update the selected-pin source data
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const src = map.getSource("selected-pin") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData(selectedGeojson);
  }, [selectedGeojson]);

  async function onSave() {
    setError(null);

    if (!name.trim()) {
      setError("Please add a name for the place.");
      return;
    }
    if (lat == null || lng == null) {
      setError("Please click the map to drop a pin.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("locations").insert([
      {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        lat,
        lng,
      },
    ]);

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    // reset
    setName("");
    setDescription("");
    setLat(null);
    setLng(null);
    setSaving(false);
  }

  if (!token) {
    return (
      <div style={{ padding: 16 }}>
        Missing <b>NEXT_PUBLIC_MAPBOX_TOKEN</b> in <b>.env.local</b>. Restart{" "}
        <b>npm run dev</b> after adding it.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-4xl mx-auto grid gap-4">
        <div className="rounded-2xl bg-white p-5 shadow border border-slate-200">
          <a className="underline text-sm text-slate-600" href="/map">
            ← Back to map
          </a>
          <h1 className="text-2xl font-bold mt-2">Add a location</h1>
          <p className="text-slate-600 mt-1">Click the map to drop a pin, then save.</p>
        </div>

        {/* MAP */}
        <div className="rounded-2xl bg-white p-4 shadow border border-slate-200">
          <div
            id="add-map"
            style={{
              height: "60vh",
              width: "100%",
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.08)",
              touchAction: "none",
            }}
          />
          <div className="text-xs text-slate-600 mt-2">
            {lat != null && lng != null
              ? `Pin: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : "Tip: click anywhere on the map to place your pin."}
          </div>
        </div>

        {/* FORM */}
        <div className="rounded-2xl bg-white p-5 shadow border border-slate-200 space-y-4">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-white p-3 text-red-700">
              <div className="font-semibold">Error</div>
              <div className="text-sm mt-1">{error}</div>
            </div>
          ) : null}

          <div>
            <label className="block font-semibold mb-2">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tam’s Roll Van"
              className="w-full text-base rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything helpful: opening times, what to order, etc."
              className="w-full text-base rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300 min-h-[110px]"
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className={`w-full rounded-xl px-5 py-3 font-semibold ${
              saving ? "bg-slate-300 text-slate-700" : "bg-black text-white"
            }`}
          >
            {saving ? "Saving…" : "Save location"}
          </button>
        </div>
      </div>
    </main>
  );
}
