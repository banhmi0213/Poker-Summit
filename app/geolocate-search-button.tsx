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
    // position: relative + the error box below being position: absolute is
    // deliberate: earlier this used a normal flex column, which made the
    // error text an extra in-flow line. Inside the search form's flex-wrap
    // row that extra line shoved every other field (都道府県/エリア/店舗タイプ)
    // into a squashed, overlapping mess instead of just appearing under the
    // button. Absolutely positioning it means a failure can never reflow —
    // let alone break the look of — the rest of the search bar; on success
    // the form navigates away before this would even matter.
    <div style={{ position: "relative", flex: "1 1 170px" }}>
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
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 5,
            padding: "6px 8px",
            borderRadius: 6,
            background: "#fff",
            border: "1px solid #d1453b",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            fontSize: 11.5,
            lineHeight: 1.4,
            color: "#d1453b",
          }}
        >
          {errorMessage}
        </div>
      )}
    </div>
  );
}
