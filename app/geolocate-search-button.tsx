"use client";

import { useRef, useState } from "react";

// Sits inside the top-page search form (app/page.tsx). On click, asks the
// browser for the visitor's current position and — on success — fills two
// hidden lat/lng fields on that same form and submits it, so "現在地から探す"
// combines with whatever q/pref/area/category the visitor already picked.
// On failure (denied permission, timeout, unsupported browser) it shows an
// inline message next to the button and does nothing else — no fallback to
// picking a prefecture automatically.
export function GeolocateSearchButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const latInputRef = useRef<HTMLInputElement>(null);
  const lngInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    setStatus("loading");
    setErrorMessage("");

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setErrorMessage("お使いのブラウザは現在地の取得に対応していません。");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latInput = latInputRef.current;
        const lngInput = lngInputRef.current;
        if (!latInput || !lngInput) {
          setStatus("error");
          setErrorMessage("現在地を取得できませんでした。もう一度お試しください。");
          return;
        }
        latInput.value = String(position.coords.latitude);
        lngInput.value = String(position.coords.longitude);
        setStatus("idle");
        latInput.closest("form")?.requestSubmit();
      },
      (err) => {
        setStatus("error");
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMessage(
            "位置情報の利用が許可されませんでした。ブラウザの設定で位置情報を許可してから、もう一度お試しください。"
          );
        } else if (err.code === err.TIMEOUT) {
          setErrorMessage("現在地の取得がタイムアウトしました。もう一度お試しください。");
        } else {
          setErrorMessage("現在地を取得できませんでした。電波の良い場所でもう一度お試しください。");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 170px" }}>
      <input type="hidden" name="lat" ref={latInputRef} />
      <input type="hidden" name="lng" ref={lngInputRef} />
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="btn"
        style={{ fontSize: 13, whiteSpace: "nowrap", width: "100%" }}
      >
        {status === "loading" ? "取得中…" : "📍 現在地から探す"}
      </button>
      {status === "error" && (
        <span style={{ fontSize: 11.5, color: "#d1453b", lineHeight: 1.4 }}>{errorMessage}</span>
      )}
    </div>
  );
}
