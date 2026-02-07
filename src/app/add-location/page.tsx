"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { supabase } from "@/lib/supabaseClient";

export default function AddLocationPage() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

    // ✅ click to place/move marker (with clear visual pin)
    map.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setLng(lng);
      setLat(lat);

      // Fly/zoom in a bit to make it feel intentional
      map.easeTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: 500,
      });

      if (!markerRef.current) {
        // Create a custom pin element (more visible than the default marker)
        const el = document.createElement("div");
        el.style.width = "28px";
        el.style.height = "28px";
        el.style.background = "#111";
        el.style.borderRadius = "50% 50% 50% 0";
        el.style.transform = "rotate(-45deg) translateY(-20px)";
        el.style.boxShadow = "0 6px 14px rgba(0,0,0,0.35)";
        el.style.position = "relative";
        el.style.animation = "rrsDrop 0.3s ease-out";

        const inner = document.createElement("div");
        inner.style.width = "12px";
        inner.style.height = "12px";
        inner.style.background = "#fff";
        inner.style.borderRadius = "999px";
        inner.style.position = "absolute";
        inner.style.top = "8px";
        inner.style.left = "8px";
        el.appendChild(inner);

        markerRef.current = new mapboxgl.Marker({
          element: el,
          anchor: "bottom",
        })
          .setLngLat([lng, lat])
          .addTo(map);
      } else {
        markerRef.current.setLngLat([lng, lat]);

        // re-trigger the drop animation when moving the pin
        const el = markerRef.current.getElement();
        el.style.animation = "none";
        // force reflow
        void el.offsetHeight;
        el.style.animation = "rrsDrop 0.3s ease-out";
      }
    });

    // Inject keyframes for the pin drop animation (keeps everything in this one file)
    const styleTag = document.createElement("style");
    styleTag.innerHTML = `
      @keyframes rrsDrop {
        0% { transform: rotate(-45deg) translateY(-40px); opacity: 0; }
        100% { transform: rotate(-45deg) translateY(-20px); opacity: 1; }
      }
    `;
    document.head.appendChild(styleTag);

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      styleTag.remove();
    };
  }, [token]);

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
    markerRef.current?.remove();
    markerRef.current = null;

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

        {/* ✅ CLICKABLE MAP */}
        <div className="rounded-2xl bg-white p-4 shadow border border-slate-200">
          <div
            style={{
              position: "relative",
              height: "60vh",
              width: "100%",
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <div id="add-map" style={{ position: "absolute", inset: 0 }} />

            {/* Optional crosshair hint before pin is set */}
            {lat == null && lng == null ? (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -100%)",
                  fontSize: 28,
                  color: "#111",
                  pointerEvents: "none",
                  opacity: 0.55,
                  textShadow: "0 2px 8px rgba(255,255,255,0.8)",
                }}
              >
                ⊕
              </div>
            ) : null}
          </div>

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
              className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything helpful: opening times, what to order, etc."
              className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300 min-h-[110px]"
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
