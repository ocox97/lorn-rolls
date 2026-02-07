import Link from "next/link";
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold mb-3">
          Roll Rating Scotland 🥖
        </h1>

        <p className="text-slate-600 mb-8">
          Find and rate the best Scottish rolls —
          from vans, bakeries, cafés and corner shops.
        </p>

        <div className="flex flex-col gap-4">
          <Link
            href="/map"
            className="rounded-2xl bg-black text-white py-4 text-lg font-semibold shadow hover:bg-slate-800 transition"
          >
            Find a roll
          </Link>
<a
  href="/add-location"
  className="rounded-2xl bg-white text-black py-4 text-lg font-semibold shadow hover:bg-slate-100 transition"
>
  Add a place
</a>

        </div>
      </div>
    </main>
  );
}
