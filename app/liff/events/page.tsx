"use client";
import { ReadableName } from "@/app/readable-name";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLiff } from "../liff-provider";
import { liffFetch } from "../api-client";
import { LiffBackLink } from "../liff-back-link";
import { EVENT_CATEGORIES } from "@/lib/constants";

type EventItem = {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  category: string | null;
  status: string;
};

const EMPTY = { title: "", location: "", description: "", startAt: "", endAt: "", category: "" };

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LiffEventsPage() {
  const { idToken } = useLiff();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      const data = await liffFetch<{ events: EventItem[] }>(idToken, "/api/liff/events");
      setEvents(data.events);
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
      setError("イベント名を入力してください。");
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
      await liffFetch(idToken, "/api/liff/events", { method: "POST", body: JSON.stringify(form) });
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
      await liffFetch(idToken, `/api/liff/events/${id}`, {
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
    if (!window.confirm("このイベントを削除しますか？")) return;
    try {
      await liffFetch(idToken, `/api/liff/events/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  async function handleUpdate(id: string, next: typeof EMPTY) {
    if (!idToken) return;
    if (!next.title.trim()) {
      setError("イベント名を入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await liffFetch(idToken, `/api/liff/events/${id}`, { method: "PATCH", body: JSON.stringify(next) });
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
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>トーナメント／イベント</h1>

      {error && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        {step === "form" && (
          <form onSubmit={handleReview}>
            <div className="field">
              <span className="muted">イベント名 *</span>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="field">
              <span className="muted">カテゴリ</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">未設定</option>
                {EVENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="muted">開催場所</span>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="field">
              <span className="muted">開始日時</span>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </div>
            <div className="field">
              <span className="muted">終了日時</span>
              <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </div>
            <div className="field">
              <span className="muted">詳細</span>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
            {form.location && <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{form.location}</p>}
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

      {events === null && <p className="muted">読み込み中…</p>}
      {events?.length === 0 && <p className="muted">イベントはまだありません。</p>}
      {events?.map((ev) => (
        <EventRow
          key={ev.id}
          event={ev}
          editing={editingId === ev.id}
          busy={busy}
          onEdit={() => setEditingId(editingId === ev.id ? null : ev.id)}
          onSave={(next) => handleUpdate(ev.id, next)}
          onToggleStatus={() => handleToggleStatus(ev.id, ev.status)}
          onDelete={() => handleDelete(ev.id)}
        />
      ))}
    </div>
  );
}

function EventRow({
  event,
  editing,
  busy,
  onEdit,
  onSave,
  onToggleStatus,
  onDelete,
}: {
  event: EventItem;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSave: (next: typeof EMPTY) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    title: event.title,
    location: event.location ?? "",
    description: event.description ?? "",
    startAt: toLocalInput(event.start_at),
    endAt: toLocalInput(event.end_at),
    category: event.category ?? "",
  });

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ fontSize: 14.5 }}><ReadableName name={event.title} /></h3>
        <span className="badge">{event.status === "published" ? "公開中" : "非公開"}</span>
      </div>
      {event.location && <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{event.location}</p>}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onEdit}>
          {editing ? "閉じる" : "編集"}
        </button>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onToggleStatus}>
          {event.status === "published" ? "非公開にする" : "公開する"}
        </button>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onDelete}>
          削除
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div className="field">
            <span className="muted">イベント名 *</span>
            <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="field">
            <span className="muted">カテゴリ</span>
            <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option value="">未設定</option>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">開催場所</span>
            <input type="text" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
          </div>
          <div className="field">
            <span className="muted">開始日時</span>
            <input type="datetime-local" value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} />
          </div>
          <div className="field">
            <span className="muted">終了日時</span>
            <input type="datetime-local" value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} />
          </div>
          <div className="field">
            <span className="muted">詳細</span>
            <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <button type="button" className="btn primary" style={{ fontSize: 12.5 }} disabled={busy} onClick={() => onSave(draft)}>
            更新する
          </button>
        </div>
      )}
    </div>
  );
}
