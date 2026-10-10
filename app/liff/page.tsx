"use client";
import { ReadableName } from "@/app/readable-name";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLiff } from "./liff-provider";
import { liffFetch, LiffApiError } from "./api-client";
import { STORE_STATUS_LABEL } from "@/lib/constants";

type MeResponse = {
  store: {
    id: string;
    name: string;
    status: string;
  };
  pendingRequests: { id: string; field: string }[];
};

const MENU = [
  { href: "/liff/profile", label: "店舗基本情報", desc: "営業時間・電話番号・説明文・住所・店名" },
  { href: "/liff/photos", label: "写真管理", desc: "追加・削除" },
  { href: "/liff/events", label: "イベント", desc: "作成・編集" },
  { href: "/liff/coupons", label: "クーポン", desc: "作成・編集" },
  { href: "/liff/jobs", label: "求人・スポット求人", desc: "求人の作成・編集／スポット求人・応募・勤務管理" },
  { href: "/liff/notices", label: "お知らせ", desc: "作成・編集・公開/非公開" },
];

// Poker Summit の店舗用LINE公式アカウント。通知を届けるには友だちになってもらう必要がある。
const LINE_OA_ADD_FRIEND_URL = "https://line.me/R/ti/p/@237fsfau";

export default function LiffDashboardPage() {
  const { ready, error, idToken, isFriend } = useLiff();
  const [autoLinkTried, setAutoLinkTried] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [notLinked, setNotLinked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!idToken) return;
    setLoadError(null);
    try {
      const data = await liffFetch<MeResponse>(idToken, "/api/liff/me");
      setMe(data);
      setNotLinked(false);
    } catch (e) {
      if (e instanceof LiffApiError && e.status === 403) {
        setNotLinked(true);
      } else {
        setLoadError(e instanceof Error ? e.message : "読み込みに失敗しました。");
      }
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  // 店舗管理画面のリンク・QRから開いたときは、連携コードを入力済みにする(?code=XXXX)
  useEffect(() => {
    if (!ready) return;
    const fromUrl = new URLSearchParams(window.location.search).get("code");
    if (fromUrl) setCode((current) => current || fromUrl.toUpperCase());
  }, [ready]);

  // 店舗管理画面のボタン・QRから開いたとき(?code=)は、押さなくても自動で連携する
  useEffect(() => {
    if (!ready || !idToken || !notLinked || autoLinkTried) return;
    const fromUrl = new URLSearchParams(window.location.search).get("code");
    if (!fromUrl) return;
    setAutoLinkTried(true);
    void linkWithCode(fromUrl.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, idToken, notLinked, autoLinkTried]);

  async function linkWithCode(value: string) {
    if (!idToken) return;
    setLinking(true);
    setLinkError(null);
    try {
      await liffFetch(idToken, "/api/liff/link", {
        method: "POST",
        body: JSON.stringify({ idToken, code: value.trim() }),
      });
      setCode("");
      await load();
      // 連携できたら、友だちでなければそのまま友だち追加の画面へ(通知を受け取るため)
      if (isFriend === false) window.location.href = LINE_OA_ADD_FRIEND_URL;
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "連携に失敗しました。");
    } finally {
      setLinking(false);
    }
  }

  async function handleLink(e: FormEvent) {
    e.preventDefault();
    if (!idToken) return;
    setLinking(true);
    setLinkError(null);
    try {
      await liffFetch(idToken, "/api/liff/link", {
        method: "POST",
        body: JSON.stringify({ idToken, code: code.trim() }),
      });
      setCode("");
      await load();
      if (isFriend === false) window.location.href = LINE_OA_ADD_FRIEND_URL;
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "連携に失敗しました。");
    } finally {
      setLinking(false);
    }
  }

  if (!ready) return <p className="muted">読み込み中…</p>;
  if (error) return <p style={{ color: "var(--critical)" }}>{error}</p>;
  if (!idToken) {
    return <p className="muted">LINEログイン情報を取得できませんでした。アプリを開き直してください。</p>;
  }

  if (notLinked) {
    return (
      <div className="card">
        <h2 style={{ marginBottom: 8, fontSize: 17 }}>店舗と連携する</h2>
        <p className="muted" style={{ marginBottom: 12, fontSize: 13.5 }}>
          {linking ? "連携しています…" : "店舗管理画面の「LINE連携コードを発行する」で表示されたコードを入力してください。"}
        </p>
        <form onSubmit={handleLink}>
          <div className="field">
            <span className="muted">ワンタイムコード</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              placeholder="例: A1B2C3D4"
            />
          </div>
          {linkError && (
            <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 8 }}>{linkError}</p>
          )}
          <button type="submit" className="btn primary" disabled={linking}>
            {linking ? "連携中…" : "連携する"}
          </button>
        </form>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <p style={{ color: "var(--critical)", marginBottom: 10 }}>{loadError}</p>
        <button className="btn" onClick={() => load()}>
          再読み込み
        </button>
      </div>
    );
  }
  if (!me) return <p className="muted">読み込み中…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 2 }}><ReadableName name={me.store.name} /></h1>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
        {STORE_STATUS_LABEL[me.store.status] ?? me.store.status} ・ LINE連携メニュー
      </p>
      {isFriend === false && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#06c755" }}>
          <p style={{ fontSize: 13.5, marginBottom: 10 }}>
            ✅ 店舗との連携が完了しました。応募やお支払いのお知らせをLINEで受け取るため、最後に公式アカウントを友だち追加してください。
          </p>
          <a href={LINE_OA_ADD_FRIEND_URL} className="btn primary" style={{ background: "#06c755", borderColor: "#06c755", color: "#fff" }}>
            友だち追加する
          </a>
        </div>
      )}
      {me.pendingRequests.length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: "var(--warning-soft)" }}>
          <p style={{ fontSize: 13.5 }}>
            {me.pendingRequests.map((r) => (r.field === "name" ? "店舗名" : "住所")).join("・")}
            の変更は運営の承認待ちです。承認され次第、公開サイトに反映されます。
          </p>
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
        {MENU.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="card"
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <h3 style={{ fontSize: 15 }}>{m.label}</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {m.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
