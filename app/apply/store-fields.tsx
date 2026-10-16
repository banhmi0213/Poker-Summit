"use client";

import { useEffect, useRef, useState } from "react";
import { findStoreCandidates } from "./match-actions";
import type { StoreCandidate } from "@/lib/store-match";

// 掲載申込みフォームの「申込み名義・店舗名・電話番号・都道府県・住所」と、
// 掲載中の店舗との結び付け(2026/10)。店名・電話番号・住所のうち2つ以上が一致した
// 掲載中の店舗を「このお店ですか？」と出し、選ばれたら matchedStoreId で送る。
// 選ばれなかった場合は新しい店舗として掲載する。
export function ApplyStoreFields({ prefOptions }: { prefOptions: string[] }) {
  const [type, setType] = useState<"store" | "company">("store");
  const [storeName, setStoreName] = useState("");
  const [tel, setTel] = useState("");
  const [pref, setPref] = useState("");
  const [address, setAddress] = useState("");
  const [candidates, setCandidates] = useState<StoreCandidate[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const filled = [storeName.trim().length >= 2, tel.replace(/\D/g, "").length >= 10, address.trim().length >= 5].filter(Boolean).length;
    if (filled < 2) {
      seq.current++;
      setCandidates([]);
      setSelected("");
      setSearching(false);
      return;
    }
    const my = ++seq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      const list = await findStoreCandidates({ name: storeName, tel, pref, address }).catch(() => []);
      if (my !== seq.current) return;
      setCandidates(list);
      setSearching(false);
      setSelected((prev) => (list.some((c) => c.id === prev && !c.has_owner) ? prev : ""));
    }, 600);
    return () => clearTimeout(timer);
  }, [storeName, tel, pref, address]);

  const matchLabel = (c: StoreCandidate) =>
    [c.name_match && "店名", c.tel_match && "電話番号", c.address_match && "住所"].filter(Boolean).join("・") + "が一致";

  return (
    <>
      <div className="field">
        <span className="muted">お申込みの名義 *</span>
        <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="radio" name="applicantType" value="store" checked={type === "store"} onChange={() => setType("store")} />
            店舗名で申し込む
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
            <input type="radio" name="applicantType" value="company" checked={type === "company"} onChange={() => setType("company")} />
            会社名で申し込む
          </label>
        </div>
      </div>
      {type === "company" && (
        <div className="field">
          <span className="muted">会社名 *</span>
          <input type="text" name="companyName" required autoComplete="organization" />
        </div>
      )}
      <div className="field">
        <span className="muted">店舗名 *</span>
        <input type="text" name="storeName" required value={storeName} onChange={(e) => setStoreName(e.target.value)} />
      </div>
      <div className="field">
        <span className="muted">店舗の電話番号</span>
        <input type="tel" name="tel" value={tel} onChange={(e) => setTel(e.target.value)} autoComplete="tel" />
      </div>
      <div className="field">
        <span className="muted">都道府県</span>
        <select name="pref" value={pref} onChange={(e) => setPref(e.target.value)}>
          <option value="">選択してください</option>
          {prefOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="muted">店舗の住所</span>
        <input type="text" name="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例）港区西麻布2-25-23 5F" />
      </div>

      <input type="hidden" name="matchedStoreId" value={selected} />
      {candidates.length > 0 && (
        <div style={{ border: "1px solid #e2c06a", background: "#fffaf0", borderRadius: 8, padding: "10px 12px", margin: "0 0 14px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700 }}>すでにPoker Summitに掲載されているお店ですか？</p>
          <p className="muted" style={{ margin: "0 0 8px", fontSize: 12 }}>
            選ぶと、今の店舗ページ（写真・営業時間など）をそのまま引き継いで店舗管理画面をお渡しします。
          </p>
          {candidates.map((c) => (
            <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, padding: "6px 0", opacity: c.has_owner ? 0.55 : 1 }}>
              <input
                type="radio"
                name="matchPick"
                checked={selected === c.id}
                disabled={c.has_owner}
                onChange={() => setSelected(c.id)}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>{c.name}</strong>
                <br />
                <span className="muted" style={{ fontSize: 12 }}>
                  {[c.pref, c.address].filter(Boolean).join(" ")}（{matchLabel(c)}）
                  {c.has_owner && " ※すでに管理者が登録済みのため選べません。お問い合わせください。"}
                </span>
              </span>
            </label>
          ))}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, padding: "6px 0" }}>
            <input type="radio" name="matchPick" checked={selected === ""} onChange={() => setSelected("")} />
            どれも違う（新しいお店として掲載する）
          </label>
        </div>
      )}
      {searching && candidates.length === 0 && (
        <p className="muted" style={{ fontSize: 12, margin: "-6px 0 12px" }}>掲載中のお店を確認しています…</p>
      )}
    </>
  );
}
