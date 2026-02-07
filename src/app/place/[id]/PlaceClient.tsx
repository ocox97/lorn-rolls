"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LocationStatsRow = {
  location_id: string;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  rating_count: number;
  avg_stars: number | null;
};

type RatingRow = {
  id: string;
  location_id: string;
  stars: number;
  extras: string[];
  sauce: string | null;
  price_pence: number | null;
  notes: string | null;
  created_at: string;
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

export default function PlaceClient({ locationId }: { locationId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [location, setLocation] = useState<LocationStatsRow | null>(null);
  const [ratings, setRatings] = useState<RatingRow[]>([]);

  // Inline form state
  const [stars, setStars] = useState<number>(5);
  const [price, setPrice] = useState<string>("");
  const [sauce, setSauce] = useState<string>("Brown");
  const [extras, setExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const statsRes = await supabase
      .from("location_stats")
      .select("location_id,name,description,lat,lng,created_at,rating_count,avg_stars")
      .eq("location_id", locationId)
      .single();

    if (statsRes.error) {
      setError(statsRes.error.message);
      setLocation(null);
      setRatings([]);
      setLoading(false);
      return;
    }

    setLocation(statsRes.data as LocationStatsRow);

    const ratingsRes = await supabase
      .from("ratings")
      .select("id,location_id,stars,extras,sauce,price_pence,notes,created_at")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (ratingsRes.error) {
      setError(ratingsRes.error.message);
      setRatings([]);
    } else {
      setRatings((ratingsRes.data ?? []) as RatingRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!locationId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const headerRating = useMemo(() => {
    if (!location) return "—";
    if (!location.rating_count || location.avg_stars === null) return "No ratings yet";
    return `★ ${location.avg_stars.toFixed(2)} · ${location.rating_count} review${
      location.rating_count === 1 ? "" : "s"
    }`;
  }, [location]);

  function toggleExtra(extra: string) {
    setExtras((prev) =>
      prev.includes(extra) ? prev.filter((x) => x !== extra) : [...prev, extra]
    );
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!locationId) return;

    if (stars < 1 || stars > 5) {
      setError("Stars must be between 1 and 5.");
      return;
    }

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

    const res = await supabase.from("ratings").insert([payload]);

    if (res.error) {
      setError(res.error.message);
      setSubmitting(false);
      return;
    }

    setStars(5);
    setPrice("");
    setSauce("Brown");
    setExtras([]);
    setNotes("");
    setSubmitting(false);

    await loadAll();
  }

  if (!locationId) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow border border-slate-200">
          Invalid location link. <a className="underline" href="/map">Back to map</a>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow border border-slate-200">
          Loading…
        </div>
      </main>
    );
  }

  if (error || !location) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-3xl mx-auto rounded-2xl bg-white p-4 shadow border border-red-200">
          <p className="font-semibold text-red-700">Couldn’t load location</p>
          <p className="text-sm text-red-700 mt-1">{error ?? "Unknown error"}</p>
          <a className="underline mt-3 inline-block" href="/map">
            Back to map
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow border border-slate-200">
          <a className="underline text-sm text-slate-600" href="/map">
            ← Back to map
          </a>

          <h1 className="text-2xl font-bold mt-2">{location.name}</h1>

          {location.description ? (
            <p className="text-slate-600 mt-1">{location.description}</p>
          ) : null}

          <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 border border-slate-200">
            <span className="font-semibold">{headerRating}</span>
          </div>
        </div>

        <form
          onSubmit={submitReview}
          className="rounded-2xl bg-white p-5 shadow border border-slate-200 space-y-5"
        >
          <h2 className="text-lg font-bold">Add your review</h2>

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
                    stars >= n
                      ? "bg-black text-white border-black"
                      : "bg-white text-slate-700 border-slate-200"
                  }`}
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
                      active
                        ? "bg-black text-white border-black"
                        : "bg-white text-slate-700 border-slate-200"
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
            {submitting ? "Saving…" : "Submit review"}
          </button>
        </form>

        <div className="rounded-2xl bg-white p-5 shadow border border-slate-200">
          <h2 className="text-lg font-bold">Reviews</h2>

          {ratings.length === 0 ? (
            <p className="text-slate-600 mt-2">No reviews yet — be the first.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {ratings.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-lg">
                      {"★".repeat(r.stars)}
                      <span className="text-slate-400">{"★".repeat(5 - r.stars)}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleDateString("en-GB")}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-slate-700 space-y-1">
                    {typeof r.price_pence === "number" ? (
                      <div>Price: £{(r.price_pence / 100).toFixed(2)}</div>
                    ) : null}
                    {r.sauce ? <div>Sauce: {r.sauce}</div> : null}
                    {r.extras?.length ? <div>Extras: {r.extras.join(", ")}</div> : null}
                  </div>

                  {r.notes ? (
                    <p className="mt-3 text-slate-700 whitespace-pre-line">{r.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
