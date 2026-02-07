"use client";

import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AddClient() {
  const params = useSearchParams();
  const locationId = params.get("locationId");

  // Your existing /add UI goes here.
  // IMPORTANT: do Supabase calls inside handlers/useEffect, not at module top-level.
  return (
    <main style={{ padding: 16 }}>
      <h1>Add rating</h1>
      <p>Location ID: {locationId ?? "none"}</p>
    </main>
  );
}
