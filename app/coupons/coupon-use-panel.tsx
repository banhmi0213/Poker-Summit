"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { confirmCouponUse, showCouponAtStore } from "@/app/member-actions";

/**
 * クーポンを使う（2026/11/02）：お店で「お店で使う」を押す → 位置情報で店の近くか確かめる →
 * 店名・特典・動く時刻の画面を店員さんに見せる → 店員さんが「使用済みにする」を押して確定。
 * 時刻が秒まで動くので、前に撮ったスクリーンショットでは使えない。
 */
const REASON_TEXT: Record<string, string> = {
  too_far: "お店から離れているため使えません。お店に着いてから、もう一度押してください。",
  location_required: "位置情報を確認できませんでした。お店にいることを確かめるため、位置情報の利用を許可してください。",
  location_denied: "位置情報の利用が許可されていません。端末やブラウザの設定で、このサイトの位置情報を許可してください。",
  location_unavailable: "位置情報を取得できませんでした。電波の良い場所で、もう一度お試しください。",
  store_location_unknown: "このお店の位置が登録されていないため、現在ご利用いただけません。",
  already_used: "このクーポンは使用済みです。",
  used_today: "このクーポンは本日使用済みです。明日以降にご利用ください。",
  limit_reached: "このクーポンは利用上限に達しました。",
  expired: "このクーポンは有効期限を過ぎました。",
  not_available: "このクーポンは現在ご利用いただけません。",
  show_expired: "画面を表示してから30分が過ぎました。もう一度「お店で使う」を押してください。",
  login_required: "ログインしてからご利用ください。",
  error: "処理できませんでした。時間をおいて、もう一度お試しください。",
};

function jstClock(d: Date) {
  return d.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function jstDateTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Shown = { useId: string; storeName: string; title: string; discount: string | null };

export function CouponUsePanel({
  couponId,
  path,
  loggedIn,
  usedUp,
  usedUpLabel,
  limitReached,
}: {
  couponId: string;
  path: string;
  loggedIn: boolean;
  usedUp: boolean;
  usedUpLabel: string;
  limitReached: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [usedAt, setUsedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!shown || usedAt) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [shown, usedAt]);

  if (!loggedIn) {
    return (
      <Link className="btn primary" href={`/login?next=${encodeURIComponent(path)}`} style={{ marginTop: 8, display: "inline-block" }}>
        ログインしてクーポンを使う
      </Link>
    );
  }

  if (usedAt) {
    return (
      <div className="card" role="status" style={{ marginTop: 8, padding: "14px 16px", textAlign: "center" }}>
        <strong style={{ display: "block", fontSize: 18 }}>使用済みにしました</strong>
        <span className="muted" style={{ fontSize: 13 }}>{jstDateTime(usedAt)}</span>
      </div>
    );
  }

  if (usedUp || limitReached) {
    return (
      <button type="button" className="btn" disabled style={{ marginTop: 8 }}>
        {usedUp ? usedUpLabel : "利用上限に達しました"}
      </button>
    );
  }

  const start = () => {
    setMessage(null);
    if (!("geolocation" in navigator)) {
      setMessage(REASON_TEXT.location_unavailable);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        startTransition(async () => {
          const r = await showCouponAtStore(couponId, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? null);
          if (r.ok) {
            setShown({ useId: r.useId, storeName: r.storeName, title: r.title, discount: r.discount });
            setNow(new Date());
          } else {
            setMessage(REASON_TEXT[r.reason] ?? REASON_TEXT.error);
          }
        });
      },
      (err) => {
        setLocating(false);
        setMessage(err.code === err.PERMISSION_DENIED ? REASON_TEXT.location_denied : REASON_TEXT.location_unavailable);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const confirm = () => {
    if (!shown) return;
    setMessage(null);
    startTransition(async () => {
      const r = await confirmCouponUse(shown.useId, path);
      if (r.ok) setUsedAt(r.usedAt);
      else {
        setMessage(REASON_TEXT[r.reason] ?? REASON_TEXT.error);
        if (r.reason === "show_expired") setShown(null);
      }
    });
  };

  if (shown) {
    return (
      <div className="card" style={{ marginTop: 8, padding: "16px", textAlign: "center" }}>
        <span className="muted" style={{ fontSize: 13 }}>店員さんにこの画面を見せてください</span>
        <strong style={{ display: "block", fontSize: 17, marginTop: 6 }}>{shown.storeName}</strong>
        <span style={{ display: "block", fontSize: 15, marginTop: 4 }}>{shown.title}{shown.discount ? `（${shown.discount}）` : ""}</span>
        <span aria-live="off" style={{ display: "block", fontSize: 34, fontWeight: 700, letterSpacing: 1, margin: "10px 0", fontVariantNumeric: "tabular-nums" }}>
          {jstClock(now)}
        </span>
        <span className="muted" style={{ display: "block", fontSize: 12.5, marginBottom: 10 }}>
          店員さんへ：内容をご確認のうえ、下のボタンを押してください。
        </span>
        <button type="button" className="btn primary" onClick={confirm} disabled={pending} style={{ width: "100%" }}>
          {pending ? "処理中…" : "使用済みにする（店員さんが押してください）"}
        </button>
        {message && <p role="alert" style={{ marginTop: 8, fontSize: 13 }}>{message}</p>}
        <button type="button" className="btn" onClick={() => setShown(null)} disabled={pending} style={{ marginTop: 8 }}>
          閉じる
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="btn primary" onClick={start} disabled={locating || pending}>
        {locating ? "位置を確認しています…" : pending ? "処理中…" : "お店で使う"}
      </button>
      {message && <p role="alert" style={{ marginTop: 6, fontSize: 13 }}>{message}</p>}
    </div>
  );
}
