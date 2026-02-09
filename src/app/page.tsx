"use client";

import { useEffect, useState } from "react";
import MapPage from "./map/page";

export default function HomePage() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 5000); // 5 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Top logo */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          zIndex: 10000,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: visible ? 1 : 0,
          transition: "opacity 1s ease", // fade duration
        }}
      >
        <img
          src="/rate-a-roll-scotland-logo.png"
          alt="Rate a Roll Scotland"
          style={{
            width: "100%",
            maxWidth: 520,
            height: "auto",
            marginTop: "max(env(safe-area-inset-top), 8px)",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.25))",
          }}
        />
      </div>

      {/* Map */}
      <MapPage />
    </>
  );
}
