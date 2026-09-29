"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLiff } from "../liff-provider";
import { liffFetch } from "../api-client";
import { LiffBackLink } from "../liff-back-link";
import { CATEGORY_OPTIONS, PREF_OPTIONS } from "@/lib/constants";

type Store = {
  id: string;
  name: string;
  category: string | null;
  pref: string | null;
  city: string | null;
  address: string | null;
  tel: string | null;
  hours: string | null;
  description: string | null;
  line_url: string | null;
  area_keywords: string | null;
};

type PendingRequest = { id: string; field: string };

type MeResponse = { store: Store; pendingRequests: PendingRequest[] };

type FormState = {
  name: string;
  category: string;
  pref: string;
  city: string;
  address: string;
  tel: string;
  hours: string;
  description: string;
  lineUrl: string;
  areaKeywords: string;
};

function toForm(store: Store): FormState {
  return {
    name: store.name ?? "",
    category: store.category ?? "",
    pref: store.pref ?? "",
    city: store.city ?? "",
    address: store.address ?? "",
    tel: store.tel ?? "",
    hours: store.hours ?? "",
    description: store.description ?? "",
    lineUrl: store.line_url ?? "",
    areaKeywords: store.area_keywords ?? "",
  };
}

const FIELD_LABEL: Record<keyof FormState, string> = {
  name: "店名",
  category: "カテゴリ",
  pref: "都道府県",
  city: "市区町村",
  address: "住所（番地以降）",
  tel: "電話番号",
  hours: "営業時間",
  description: "店舗説明文",
  lineUrl: "LINE URL",
  areaKeywords: "エリアキーワード",
};

export default function LiffProfilePage() {
  const { idToken } = useLiff();
  const [store, setStore] = useState<Store | null>(null);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!idToken) return;
    setError(null);
    try {
      const data = await liffFetch<MeResponse>(idToken, "/api/liff/me");
      setStore(data.store);
      setPending(data.pendingRequests);
      setForm(toForm(data.store));
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました。");
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  const nameLocked = pending.some((p) => p.field === "name");
  const addressLocked = pending.some((p) => p.field === "address");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleReview(e: FormEvent) {
    e.preventDefault();
    if (!form?.name.trim()) {
      setError("店名を入力してください。");
      return;
    }
    setError(null);
    setStep("confirm");
  }

  async function handleSave() {
    if (!idToken || !form) return;
    setSaving(true);
    setError(null);
    try {
      await liffFetch(idToken, "/api/liff/store", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category || null,
          pref: form.pref,
          city: form.city,
          address: form.address,
          tel: form.tel,
          hours: form.hours,
          description: form.description,
          lineUrl: form.lineUrl || null,
          areaKeywords: form.areaKeywords || null,
        }),
      });
      setStep("done");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
      setStep("form");
    } finally {
      setSaving(false);
    }
  }

  if (error && !store) {
    return (
      <div>
        <LiffBackLink />
        <p style={{ color: "var(--critical)" }}>{error}</p>
      </div>
    );
  }
  if (!store || !form) {
    return (
      <div>
        <LiffBackLink />
        <p className="muted">読み込み中…</p>
      </div>
    );
  }

  return (
    <div>
      <LiffBackLink />
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>店舗基本情報</h1>

      {(nameLocked || addressLocked) && (
        <div className="card" style={{ marginBottom: 14, background: "var(--warning-soft)" }}>
          <p style={{ fontSize: 13 }}>
            {[nameLocked && "店名", addressLocked && "住所"].filter(Boolean).join("・")}
            の変更は運営の承認待ちです。承認されるまで編集できません。
          </p>
        </div>
      )}

      {step === "done" && (
        <div className="card" style={{ marginBottom: 14, background: "var(--good-soft)" }}>
          <p style={{ fontSize: 13.5 }}>保存しました。</p>
        </div>
      )}

      {step === "form" && (
        <form onSubmit={handleReview} className="card">
          <div className="field">
            <span className="muted">店名 *</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              disabled={nameLocked}
              required
            />
          </div>
          <div className="field">
            <span className="muted">カテゴリ</span>
            <select value={form.category} onChange={(e) => update("category", e.target.value)}>
              <option value="">未設定</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">都道府県</span>
            <select
              value={form.pref}
              onChange={(e) => update("pref", e.target.value)}
              disabled={addressLocked}
            >
              <option value="">未設定</option>
              {PREF_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">市区町村</span>
            <input
              type="text"
              value={form.city}
              onChange={(e) => update("city", e.target.value)}
              disabled={addressLocked}
            />
          </div>
          <div className="field">
            <span className="muted">住所（番地以降）</span>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              disabled={addressLocked}
            />
          </div>
          <div className="field">
            <span className="muted">電話番号</span>
            <input type="text" value={form.tel} onChange={(e) => update("tel", e.target.value)} />
          </div>
          <div className="field">
            <span className="muted">営業時間</span>
            <input type="text" value={form.hours} onChange={(e) => update("hours", e.target.value)} />
          </div>
          <div className="field">
            <span className="muted">店舗説明文</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
          <div className="field">
            <span className="muted">LINE URL</span>
            <input type="text" value={form.lineUrl} onChange={(e) => update("lineUrl", e.target.value)} />
          </div>
          <div className="field">
            <span className="muted">エリアキーワード</span>
            <input
              type="text"
              value={form.areaKeywords}
              onChange={(e) => update("areaKeywords", e.target.value)}
            />
          </div>
          {error && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <button type="submit" className="btn primary">
            確認画面へ
          </button>
        </form>
      )}

      {step === "confirm" && (
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>この内容で保存します</h3>
          <table style={{ width: "100%", fontSize: 13, marginBottom: 12 }}>
            <tbody>
              {(Object.keys(form) as (keyof FormState)[]).map((key) => (
                <tr key={key}>
                  <th style={{ textAlign: "left", verticalAlign: "top", paddingRight: 8, width: 96 }}>
                    {FIELD_LABEL[key]}
                  </th>
                  <td style={{ whiteSpace: "pre-wrap" }}>{form[key] || "（未設定）"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(nameLocked && form.name !== (store.name ?? "")) && (
            <p style={{ color: "var(--warning)", fontSize: 12.5, marginBottom: 8 }}>
              ※店名の変更はすでに承認待ちのため反映できません。
            </p>
          )}
          {error && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={() => setStep("form")} disabled={saving}>
              修正する
            </button>
            <button type="button" className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
            ※店名・住所の変更は運営確認後に公開サイトへ反映されます。それ以外の項目はすぐに反映されます。
          </p>
        </div>
      )}
    </div>
  );
}
