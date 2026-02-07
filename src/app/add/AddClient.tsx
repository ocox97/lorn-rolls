"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
  description: string | null;
};

const EXTRAS_OPTIONS = [
  "Tattie scone",
  "Fried egg",
  "Bacon",
  "Sausage",
  "Black pudding",
  "Hash brown",
  "Cheese",
  "Onion",
  "Haggis",
] as const;

const SAUCE_OPTIONS = ["Brown", "Ketchup", "HP", "Chilli", "Mayo", "None"] as const;

export default function AddClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const locationId = searchParams.get("locationId") ?? "";

  const [place, setPlace] = useState<LocationRow | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [stars, setStars] = useState<number>(5);
  const [price, setPrice] = useState<string>("");
  const [sauce, setSauce] = useState<string>("Brown");
  const [extras, setExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");

  // ✅ Gatekeeper: if opened without locationId, bounce to map
  useEffect(() => {
    if (!locationId) {
      router.replace("/map");
    }
  }, [locationId, router]);

  // Load place info for context
  useEffect(() => {
    let cancelled = false;

    async function loadPlace() {
      setError(null);

      if (!locationId) return;

      // If env vars missing and supabase is null (safe client), show clear error
      if (!supabase) {
        setError("Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY in Vercel.");
        setLoadingPlace(false);
        return;
      }

      setLoadingPlace(true);

      const res = await supabase
        .from("locations")
        .select("id,name,description")
        .eq("id", locationId)
        .single();

      if (cancelled) return;

      if (res.error) {
        setError(res.error.message);
        setPlace(null);
      } else {
        setPlace(res.data as LocationRow);
      }

      setLoadingPlace(false);
    }

    loadPlace();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  function toggleExtra(extra: string) {
    setExtras((prev) => (prev.includes(extra) ? prev.filter((x) => x !== extra) : [...prev, extra]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!locationId) return;

    if (!supabase) {
      setError("Supabase is not configured. Check NEXT_PUBLIC_SUPABASE_URL / ANON_KEY in Vercel.");
      return;
    }

    if (stars < 1 || stars > 5) {
      setError("Stars must be between 1 and 5.");
      return;
    }

    // price → pence
    let cleanedPricePence: number | null = null;
    if (price.trim()) {
      const cleaned = price.replace("£", "");
      const n = Number(cleaned);
      if (!Number.isFinite(n) || n < 0) {
        setError("Price looks invalid. Use a number like 3.50");
        return;
      }
      cleanedPricePence = Math.round(n * 100);
    }

    const payload = {
      location_id: locationId,
      stars: Number(stars),
      sauce: sauce === "None" ? null : sauce,
      extras: extras ?? [],
      price_pence: cleanedPricePence,
      notes: notes.trim() ? notes.trim() : null,
    };

    setSubmitting(true);

    const insertRes = await supabase.from("ratings").insert([payload]);

    if (insertRes.error) {
      setError(insertRes.error.message);
      setSubmitting(false);
      return;
    }

    router.push(`/place/${encodeURIComponent(locationId)}`);
  }

  // While redirecting, show nothing
  if (!locationId) return null;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow border border-slate-200">
          <a className="underline text-sm text-slate-600" href="/map">
            ← Back to map
          </a>

          <h1 className="text-2xl font-bold mt-2">Rate a roll</h1>

          {loadingPlace ? (
            <p className="text-slate-600 mt-1">Loading place…</p>
          ) : place ? (
            <p className="text-slate-600 mt-1">
              {place.name}
              {place.description ? <span className="text-slate-500"> — {place.description}</span> : null}
            </p>
          ) : (
            <p className="text-slate-600 mt-1">Location ID: {locationId}</p>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-4 text-red-700">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="rounded-2xl bg-white p-5 shadow border border-slate-200 space-y-5"
        >
          {/* Stars */}
          <div>
            <label className="block font-semibold mb-2">Stars</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  className={`px-3 py-2 rounded-xl border text-lg ${
                    stars >= n ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200"
                  }`}
                  aria-label={`${n} stars`}
                >
                  ★
                </button>
              ))}
              <span className="ml-2 text-slate-600 text-sm">{stars}/5</span>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block font-semibold mb-2">Price paid (optional)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 3.50"
              className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
              inputMode="decimal"
            />
          </div>

          {/* Sauce */}
          <div>
            <label className="block font-semibold mb-2">Sauce (optional)</label>
            <select
              value={sauce}
              onChange={(e) => setSauce(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300"
            >
              {SAUCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Extras */}
          <div>
            <label className="block font-semibold mb-2">Extras (optional)</label>
            <div className="flex flex-wrap gap-2">
              {EXTRAS_OPTIONS.map((x) => {
                const active = extras.includes(x);
                return (
                  <button
                    key={x}
                    type="button"
                    onClick={() => toggleExtra(x)}
                    className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
                      active ? "bg-black text-white border-black" : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    {x}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How was the lorne? Roll freshness? Value for money?"
              className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-slate-300 min-h-[120px]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-xl px-5 py-3 font-semibold ${
              submitting ? "bg-slate-300 text-slate-700" : "bg-black text-white"
            }`}
          >
            {submitting ? "Saving…" : "Submit rating"}
          </button>
        </form>
      </div>
    </main>
  );
}
