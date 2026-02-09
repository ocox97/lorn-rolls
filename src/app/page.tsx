import MapPage from "./map/page";

export default function HomePage() {
  return (
    <>
      {/* Logo overlay */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10000,
          background: "#fff",
          padding: "10px 14px",
          borderRadius: 16,
          boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
          border: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <img
          src="/rate-a-roll-scotland-logo.png"
          alt="Rate a Roll Scotland"
          style={{
            height: "clamp(36px, 8vw, 48px)",      // adjust to taste
            width: "auto",
            display: "block",
          }}
        />
      </div>

      {/* Map */}
      <MapPage />
    </>
  );
}
