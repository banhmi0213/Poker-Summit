"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLiff } from "../liff-provider";
import { liffFetch } from "../api-client";
import { LiffBackLink } from "../liff-back-link";

type Coupon = {
  id: string;
  title: string;
  discount: string | null;
  description: string | null;
  code: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  used_count: number;
  active: boolean;
};

const EMPTY = { title: "", discount: "", description: "", code: "", validUntil: "", usageLimit: "" };

export default function LiffCouponsPage() {
  const { idToken } = useLiff();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      const data = await liffFetch<{ coupons: Coupon[] }>(idToken, "/api/liff/coupons");
      setCoupons(data.coupons);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました。");
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  function handleReview(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("クーポンのタイトルを入力してください。");
      return;
    }
    setError(null);
    setStep("confirm");
  }

  async function handleCreate() {
    if (!idToken) return;
    setBusy(true);
    setError(null);
    try {
      await liffFetch(idToken, "/api/liff/coupons", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(EMPTY);
      setStep("form");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!idToken) return;
    try {
      await liffFetch(idToken, `/api/liff/coupons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: false }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました。");
    }
  }

  async function handleDelete(id: string) {
    if (!idToken) return;
    if (!window.confirm("このクーポンを削除しますか？")) return;
    try {
      await liffFetch(idToken, `/api/liff/coupons/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  async function handleUpdate(id: string, next: typeof EMPTY) {
    if (!idToken) return;
    if (!next.title.trim()) {
      setError("クーポンのタイトルを入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await liffFetch(idToken, `/api/liff/coupons/${id}`, {
        method: "PATCH",
        body: JSON.stringify(next),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <LiffBackLink />
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>クーポン</h1>

      {error && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        {step === "form" && (
          <form onSubmit={handleReview}>
            <div className="field">
              <span className="muted">タイトル *</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <span className="muted">割引内容</span>
              <input
                type="text"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
                placeholder="例: ドリンク1杯無料"
              />
            </div>
            <div className="field">
              <span className="muted">説明</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="field">
              <span className="muted">クーポンコード</span>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="field">
              <span className="muted">有効期限</span>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
            <div className="field">
              <span className="muted">利用上限回数</span>
              <input
                type="number"
                min={0}
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              />
            </div>
            <button type="submit" className="btn primary">
              確認画面へ
            </button>
          </form>
        )}

        {step === "confirm" && (
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>この内容で作成します</h3>
            <p style={{ fontSize: 13.5, marginBottom: 4 }}>{form.title}</p>
            {form.discount && <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{form.discount}</p>}
            {form.description && <p style={{ fontSize: 13, marginBottom: 8 }}>{form.description}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setStep("form")} disabled={busy}>
                修正する
              </button>
              <button type="button" className="btn primary" onClick={handleCreate} disabled={busy}>
                {busy ? "作成中…" : "作成する"}
              </button>
            </div>
          </div>
        )}
      </div>

      {coupons === null && <p className="muted">読み込み中…</p>}
      {coupons?.length === 0 && <p className="muted">クーポンはまだありません。</p>}
      {coupons?.map((c) => (
        <CouponRow
          key={c.id}
          coupon={c}
          editing={editingId === c.id}
          busy={busy}
          onEdit={() => setEditingId(editingId === c.id ? null : c.id)}
          onSave={(next) => handleUpdate(c.id, next)}
          onDeactivate={() => handleDeactivate(c.id)}
          onDelete={() => handleDelete(c.id)}
        />
      ))}
    </div>
  );
}

function CouponRow({
  coupon,
  editing,
  busy,
  onEdit,
  onSave,
  onDeactivate,
  onDelete,
}: {
  coupon: Coupon;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSave: (next: typeof EMPTY) => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    title: coupon.title,
    discount: coupon.discount ?? "",
    description: coupon.description ?? "",
    code: coupon.code ?? "",
    validUntil: coupon.valid_until ?? "",
    usageLimit: coupon.usage_limit != null ? String(coupon.usage_limit) : "",
  });

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ fontSize: 14.5 }}>{coupon.title}</h3>
        <span className="badge">{coupon.active ? "掲載中" : "停止中"}</span>
      </div>
      {coupon.discount && <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{coupon.discount}</p>}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onEdit}>
          {editing ? "閉じる" : "編集"}
        </button>
        {coupon.active && (
          <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onDeactivate}>
            停止する
          </button>
        )}
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onDelete}>
          削除
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div className="field">
            <span className="muted">タイトル *</span>
            <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="field">
            <span className="muted">割引内容</span>
            <input
              type="text"
              value={draft.discount}
              onChange={(e) => setDraft({ ...draft, discount: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="muted">説明</span>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="muted">クーポンコード</span>
            <input type="text" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          </div>
          <div className="field">
            <span className="muted">有効期限</span>
            <input
              type="date"
              value={draft.validUntil}
              onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="muted">利用上限回数</span>
            <input
              type="number"
              min={0}
              value={draft.usageLimit}
              onChange={(e) => setDraft({ ...draft, usageLimit: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="btn primary"
            style={{ fontSize: 12.5 }}
            disabled={busy}
            onClick={() => onSave(draft)}
          >
            更新する
          </button>
        </div>
      )}
    </div>
  );
}
