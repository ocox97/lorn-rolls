import MapPage from "./map/page";

export default function HomePage() {
  return (
    <>
      {/* Title overlay */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10000,
          background: "#fff",
          padding: "10px 16px",
          borderRadius: 16,
          fontWeight: 900,
          fontSize: 16,
          boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
          border: "1px solid rgba(0,0,0,0.08)",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        🥓 Roll Rating Scotland
      </div>

      {/* Map */}
      <MapPage />
    </>
  );
}