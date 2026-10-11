"use client";

import { useEffect, useState } from "react";

export function HeroBackgroundVideo() {
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setEnabled(desktop.matches && !reducedMotion.matches);
      setPlaying(false);
    };
    update();
    desktop.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
    };
  }, []);

  if (!enabled) return null;

  return (
    <video
      className={`ps-region-hero__bg ps-region-hero__video${playing ? " is-playing" : ""}`}
      src="/images/poker-region-hero-video.mp4"
      autoPlay muted loop playsInline preload="none"
      aria-hidden="true" tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onError={() => setPlaying(false)}
    />
  );
}
