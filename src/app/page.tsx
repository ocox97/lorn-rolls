import MapPage from "./map/page";

export default function HomePage() {
  return (
    <>
      {/* Top logo bar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          zIndex: 10000,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none", // map still draggable underneath
        }}
      >
        <img
          src="/rate-a-roll-scotland-logo.png"
          alt="Rate a Roll Scotland"
          style={{
            width: "100%",
            maxWidth: 520,        // stops it getting silly on desktop
            height: "auto",
            marginTop: 8,         // safe spacing from notch/status bar
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.25))",
          }}
        />
      </div>

      {/* Map */}
      <MapPage />
    </>
  );
}
