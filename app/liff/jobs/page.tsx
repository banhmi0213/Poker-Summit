"use client";
import { ReadableName } from "@/app/readable-name";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLiff } from "../liff-provider";
import { liffFetch } from "../api-client";
import { LiffBackLink } from "../liff-back-link";
import { JOB_TYPE_OPTIONS } from "@/lib/constants";
import Link from "next/link";

type Job = {
  id: string;
  title: string;
  job_type: string | null;
  salary: string | null;
  description: string | null;
  status: string;
};

const EMPTY = { title: "", jobType: "", salary: "", description: "" };

export default function LiffJobsPage() {
  const { idToken } = useLiff();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      const data = await liffFetch<{ jobs: Job[] }>(idToken, "/api/liff/jobs");
      setJobs(data.jobs);
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
      setError("求人タイトルを入力してください。");
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
      await liffFetch(idToken, "/api/liff/jobs", { method: "POST", body: JSON.stringify(form) });
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
      await liffFetch(idToken, `/api/liff/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: status === "open" ? "closed" : "open" }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました。");
    }
  }

  async function handleDelete(id: string) {
    if (!idToken) return;
    if (!window.confirm("この求人を削除しますか？")) return;
    try {
      await liffFetch(idToken, `/api/liff/jobs/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  async function handleUpdate(id: string, next: typeof EMPTY) {
    if (!idToken) return;
    if (!next.title.trim()) {
      setError("求人タイトルを入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await liffFetch(idToken, `/api/liff/jobs/${id}`, { method: "PATCH", body: JSON.stringify(next) });
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
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>求人・スポット求人</h1>
      <nav aria-label="求人の種類" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Link href="/liff/jobs" className="btn primary" aria-current="page" prefetch={false}>求人</Link>
        <Link href="/store/profile/spot-jobs" className="btn" prefetch={false}>スポット求人</Link>
      </nav>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
        スポット求人の登録・編集、応募・勤務管理は「スポット求人」から開けます。店舗ログインが必要な場合は、ログイン後に表示されます。
      </p>

      {error && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        {step === "form" && (
          <form onSubmit={handleReview}>
            <div className="field">
              <span className="muted">求人タイトル *</span>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="field">
              <span className="muted">雇用形態</span>
              <select value={form.jobType} onChange={(e) => setForm({ ...form, jobType: e.target.value })}>
                <option value="">未設定</option>
                {JOB_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="muted">給与</span>
              <input type="text" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} />
            </div>
            <div className="field">
              <span className="muted">仕事内容</span>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <button type="submit" className="btn primary">
              確認画面へ
            </button>
          </form>
        )}
        {step === "confirm" && (
          <div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>この内容で募集を開始します</h3>
            <p style={{ fontSize: 13.5, marginBottom: 4 }}>{form.title}</p>
            {form.jobType && <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{form.jobType}</p>}
            {form.salary && <p style={{ fontSize: 13, marginBottom: 8 }}>{form.salary}</p>}
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

      {jobs === null && <p className="muted">読み込み中…</p>}
      {jobs?.length === 0 && <p className="muted">求人はまだありません。</p>}
      {jobs?.map((j) => (
        <JobRow
          key={j.id}
          job={j}
          editing={editingId === j.id}
          busy={busy}
          onEdit={() => setEditingId(editingId === j.id ? null : j.id)}
          onSave={(next) => handleUpdate(j.id, next)}
          onToggleStatus={() => handleToggleStatus(j.id, j.status)}
          onDelete={() => handleDelete(j.id)}
        />
      ))}
    </div>
  );
}

function JobRow({
  job,
  editing,
  busy,
  onEdit,
  onSave,
  onToggleStatus,
  onDelete,
}: {
  job: Job;
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSave: (next: typeof EMPTY) => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    title: job.title,
    jobType: job.job_type ?? "",
    salary: job.salary ?? "",
    description: job.description ?? "",
  });

  return (
    <div className="card" style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <h3 style={{ fontSize: 14.5 }}><ReadableName name={job.title} /></h3>
        <span className="badge">{job.status === "open" ? "募集中" : "停止中"}</span>
      </div>
      {job.job_type && <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{job.job_type}</p>}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onEdit}>
          {editing ? "閉じる" : "編集"}
        </button>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onToggleStatus}>
          {job.status === "open" ? "募集を停止する" : "募集を再開する"}
        </button>
        <button type="button" className="btn" style={{ fontSize: 12 }} onClick={onDelete}>
          削除
        </button>
      </div>

      {editing && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div className="field">
            <span className="muted">求人タイトル *</span>
            <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="field">
            <span className="muted">雇用形態</span>
            <select value={draft.jobType} onChange={(e) => setDraft({ ...draft, jobType: e.target.value })}>
              <option value="">未設定</option>
              {JOB_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="muted">給与</span>
            <input type="text" value={draft.salary} onChange={(e) => setDraft({ ...draft, salary: e.target.value })} />
          </div>
          <div className="field">
            <span className="muted">仕事内容</span>
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
