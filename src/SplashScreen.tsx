import React, { useEffect, useState } from "react";
import "./index.css";

const SplashScreen = ({ children }: { children: React.ReactNode }) => {
  const [show, setShow] = useState(true);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    // Check screen width once on load
    setIsMobile(window.innerWidth <= 768); // you can adjust 768 to 1024 for tablets

    const timeout = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(timeout);
  }, []);

  if (!isMobile || !show) {
    return <>{children}</>;
  }

  return (
    <div className="splash-screen">
      <div className="logo-effect-wrapper">
        <img
          src="/smartcfo logo bg.png"
          alt="App Logo"
          className="logo-effect"
          draggable={false}
          style={{
            userSelect: "none",
            WebkitUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none",
          }}
        />
      </div>
    </div>
  );
};

export default SplashScreen;
