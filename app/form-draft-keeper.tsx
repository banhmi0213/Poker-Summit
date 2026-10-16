"use client";

import { useEffect, useState } from "react";

// 入力途中のフォーム内容の自動保存・復元(サイト全体共通、2026/10)。
// 記入中にページを更新(リロード)したり、誤って戻ったりしても、書きかけの内容が消えないようにする。
// 総合管理・店舗管理・マイページ・掲載申込みなど、POST するフォームすべてが対象。各フォームの変更は不要。
//
// - 保存先はそのタブの sessionStorage(タブを閉じれば消える。共用端末でも他人に残りにくい)
// - パスワード・ファイル・hidden 欄は保存しない
// - 送信したら下書きは「送信済み」になり、次の表示でエラー(?error=)が出ていなければ破棄。
//   エラーで戻ってきたときは書いた内容を戻す
// - 24時間より古い下書きは使わない
// - 個別に止めたいフォームには data-no-draft を付ける。検索など method="get" のフォームは対象外

const PREFIX = "ps-draft:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const IGNORED_PARAMS = ["error", "ok", "done", "saved", "success", "msg", "message", "sent", "updated"];

type Draft = { savedAt: number; submitted?: boolean; values: Record<string, string | boolean> };

const restoredFields = new WeakSet<Element>();
const handledForms = new WeakSet<HTMLFormElement>();
let notify: ((key: string) => void) | null = null;

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function eligibleForm(form: HTMLFormElement): boolean {
  if (form.hasAttribute("data-no-draft")) return false;
  if ((form.getAttribute("method") ?? "").toLowerCase() === "get") return false;
  return true;
}

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function eligibleField(el: Element): el is Field {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return !el.hasAttribute("data-no-draft") && !!(el.name || el.id);
  }
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.hasAttribute("data-no-draft") || !(el.name || el.id)) return false;
  const t = el.type;
  if (["password", "file", "hidden", "submit", "button", "reset", "image"].includes(t)) return false;
  if (el.autocomplete === "one-time-code" || el.autocomplete?.startsWith("cc-")) return false;
  return true;
}

// フォームの中の欄に「名前(チェックボックス・ラジオは値も)+出現順」で識別子を付ける
function fieldEntries(form: HTMLFormElement): [string, Field][] {
  const seen = new Map<string, number>();
  const out: [string, Field][] = [];
  for (const el of Array.from(form.elements)) {
    if (!eligibleField(el)) continue;
    let base = el.name || `#${el.id}`;
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) base += `=${el.value}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push([n ? `${base}~${n}` : base, el]);
  }
  return out;
}

function pageKey(): string {
  const url = new URL(window.location.href);
  for (const p of IGNORED_PARAMS) url.searchParams.delete(p);
  url.searchParams.sort();
  const q = url.searchParams.toString();
  return url.pathname + (q ? `?${q}` : "");
}

// 同じページの何番目のフォームかで区別する(欄の構成は条件付き表示で変わるのでキーには含めない)。
// 復元は名前が一致する欄にだけ行うので、取り違えても他の欄を壊さない
function formKey(form: HTMLFormElement): string | null {
  const forms = Array.from(document.forms).filter(eligibleForm);
  const index = forms.indexOf(form);
  if (index < 0) return null;
  return `${PREFIX}${pageKey()}#${index}`;
}

function readDraft(key: string): Draft | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || typeof d.values !== "object" || Date.now() - d.savedAt > MAX_AGE_MS) {
      s.removeItem(key);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

function saveForm(form: HTMLFormElement, submitted = false) {
  if (!eligibleForm(form)) return;
  const key = formKey(form);
  const s = storage();
  if (!key || !s) return;
  // いま表示されていない欄(切替で隠れた欄など)の値も残しておく
  const prev = readDraft(key);
  const values: Record<string, string | boolean> = prev && !prev.submitted ? { ...prev.values } : {};
  let hasContent = false;
  for (const [k, el] of fieldEntries(form)) {
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      values[k] = el.checked;
      if (el.checked !== el.defaultChecked) hasContent = true;
    } else {
      values[k] = el.value;
      if (el instanceof HTMLSelectElement || el.value !== (el as HTMLInputElement).defaultValue) hasContent = true;
    }
  }
  try {
    if (!hasContent && !submitted && !prev) {
      s.removeItem(key);
      return;
    }
    s.setItem(key, JSON.stringify({ savedAt: Date.now(), submitted, values } satisfies Draft));
  } catch {
    /* 容量オーバーなどは諦める(入力の邪魔はしない) */
  }
}

// React の制御された入力欄にも反映されるよう、ネイティブの setter で値を入れてからイベントを流す
function setFieldValue(el: Field, value: string | boolean) {
  if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    if (typeof value === "boolean" && el.checked !== value && !el.disabled) {
      if (el.type === "radio" && !value) return; // ラジオは「選ばれている方」を戻せば足りる
      el.click();
    }
    return;
  }
  if (typeof value !== "string" || el.value === value || el.disabled || (el as HTMLInputElement).readOnly) return;
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function restoreForm(form: HTMLFormElement) {
  if (!eligibleForm(form)) return;
  const key = formKey(form);
  if (!key) return;
  const draft = readDraft(key);
  const first = !handledForms.has(form);
  handledForms.add(form);
  if (!draft) return;
  if (draft.submitted) {
    // 送信後に戻ってきた: エラー表示があれば書いた内容を戻す。なければ保存できたとみなして破棄
    const hasError = new URL(window.location.href).searchParams.has("error");
    if (!hasError) {
      if (first) storage()?.removeItem(key);
      return;
    }
  }
  let restored = 0;
  for (const [k, el] of fieldEntries(form)) {
    if (restoredFields.has(el) || !(k in draft.values)) continue;
    restoredFields.add(el);
    const before = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? el.checked : el.value;
    setFieldValue(el, draft.values[k]);
    const after = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? el.checked : el.value;
    if (before !== after) restored++;
  }
  if (restored > 0 && !draft.submitted) notify?.(key);
}

function scan() {
  for (const form of Array.from(document.forms)) restoreForm(form);
}

export function FormDraftKeeper() {
  const [restoredKeys, setRestoredKeys] = useState<string[]>([]);

  useEffect(() => {
    notify = (key) => setRestoredKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    const timers = new Map<HTMLFormElement, number>();

    const onInput = (e: Event) => {
      const el = e.target as Element | null;
      const form = (el as Field | null)?.form;
      if (!form || !eligibleField(el!)) return;
      window.clearTimeout(timers.get(form));
      timers.set(form, window.setTimeout(() => saveForm(form), 300));
    };
    const onSubmit = (e: Event) => {
      const form = e.target;
      if (form instanceof HTMLFormElement) {
        window.clearTimeout(timers.get(form));
        saveForm(form, true);
      }
    };
    // ページを離れる直前(リロード含む)にも保存し、最後の数文字を取りこぼさない
    const onHide = () => {
      timers.forEach((t, form) => {
        window.clearTimeout(t);
        saveForm(form);
      });
      timers.clear();
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pagehide", onHide);

    // 初回(ハイドレーション後)と、後から出てくるフォーム・欄(画面切替・条件付き表示)を復元
    let pending = 0;
    const schedule = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(scan, 80);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      notify = null;
      mo.disconnect();
      window.clearTimeout(pending);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  if (restoredKeys.length === 0) return null;

  const discard = () => {
    const s = storage();
    restoredKeys.forEach((k) => s?.removeItem(k));
    window.location.reload();
  };

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 1000,
        background: "#1f2937",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 10,
        fontSize: 14,
        display: "flex",
        gap: 12,
        alignItems: "center",
        boxShadow: "0 4px 16px rgba(0,0,0,.25)",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span>入力途中の内容を復元しました</span>
      <button
        type="button"
        onClick={discard}
        style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.5)", borderRadius: 6, padding: "4px 10px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        破棄する
      </button>
      <button
        type="button"
        aria-label="閉じる"
        onClick={() => setRestoredKeys([])}
        style={{ background: "transparent", color: "#fff", border: "none", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}
