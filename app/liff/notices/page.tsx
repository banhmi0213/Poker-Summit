"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLiff } from "../liff-provider";
import { liffFetch } from "../api-client";
import { LiffBackLink } from "../liff-back-link";

type Notice = {
  id: string;
  title: string;
  body: string | null;
  status: string;
};

const EMPTY = { title: "", body: "" };

export default function LiffNoticesPage() {
  const { idToken } = useLiff();
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      const data = await liffFetch<{ notices: Notice[] }>(idToken, "/api/liff/notices");
      setNotices(data.notices);
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
      setError("お知らせのタイトルを入力してください。");
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
      await liffFetch(idToken, "/api/liff/notices", { method: "POST", body: JSON.stringify(form) });
      setForm(EMPTY);
      setStep("form");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "作成に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(id: string, status: string) {
    if (!idToken) return;
    try {
      await liffFetch(idToken, `/api/liff/notices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: status === "published" ? "hidden" : "published" }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました。");
    }
  }

  async function handleDelete(id: string) {
    if (!idToken) return;
    if (!window.confirm("このお知らせを削除しますか？")) return;
    try {
      await liffFetch(idToken, `/api/liff/notices/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  async function handleUpdate(id: string, next: typeof EMPTY) {
    if (!idToken) return;
    if (!next.title.trim()) {
      setError("お知らせのタイトルを入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await liffFetch(idToken, `/api/liff/notices/${id}`, { method: "PATCH", body: JSON.stringify(next) });
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
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>お知らせ</h1>

      {error && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        {step === "form" && (
          <form onSubmit={handleReview}>
            <div className="field">
              <span className="muted">タイトル *</span>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="field">
              <span className="muted">本文</span>
              <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <button type="submit" className="btn primary">
              確認画面へ
            </button>
          </form>
        )}
        {step === "confirm" && (
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>この内容で掲載します</h3>
            <p style={{ fontSize: 13.5, marginBottom: 4 }}>{form.title}</p>
            {form.body && <p className="muted" style={{ fontSize: 13, marginBottom: 8, whiteSpace: "pre-wrap" }}>{form.body}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setStep("form")} disabled={busy}>
                修正する
              </button>
              <button type="button" className="btn primary" onClick={handleCreate} disabled={busy}>
                {busy ? "作成中…" : "掲載する"}
              </button>
            </div>
          </div>
        )}
      </div>

      {notices === null && <p className="muted">読み込み中…</p>}
      {notices?.length === 0 && <p className="muted">お知らせはまだありません。</p>}
      {notices?.map((n) => (
        <NoticeRow
          key={n.id}
          notice={n}
          editing={editingId === n.id}
          busy={busy}
          onEdit={() => setEditingId(editingId === n.id ? null : n.id)}
          onSave={(next) => handleUpdate(n.id, next)}
          onToggleStatus={() => handleToggleStatus(n.id, n.status)}
          onDelete={() => handleDelete(n.id)}
        />
      ))}
    </div>
  );
}

function NoticeRow({
  notice,
  editing,
  busy,
  onEdit,
  onSave,
  onToggleStatus,
  onDelete,
}: {
  notice: Notice;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSave: (next: typeof EMPTY) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({ title: notice.title, body: notice.body ?? "" });

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ fontSize: 14.5 }}>{notice.title}</h3>
        <span className="badge">{notice.status === "published" ? "公開中" : "非公開"}</span>
      </div>
      {notice.body && <p className="muted" style={{ fontSize: 12.5, marginTop: 4, whiteSpace: "pre-wrap" }}>{notice.body}</p>}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onEdit}>
          {editing ? "閉じる" : "編集"}
        </button>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onToggleStatus}>
          {notice.status === "published" ? "非公開にする" : "公開する"}
        </button>
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
            <span className="muted">本文</span>
            <textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </div>
          <button type="button" className="btn primary" style={{ fontSize: 12.5 }} disabled={busy} onClick={() => onSave(draft)}>
            更新する
          </button>
        </div>
      )}
    </div>
  );
}
