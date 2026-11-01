"use client";

import { useEffect, useState } from "react";

// 送信ボタンの連打防止(サイト全体・店舗管理・総合管理の POST フォーム共通、2026/10)。
// 1回目の送信から数秒は同じフォームの再送信を無視し、「送信中です…」を表示する。
// 押したのに反応がないと思って何度も押し、申込みや請求書が二重にできるのを防ぐ。
// 検索など method="get" のフォームと、data-allow-resubmit を付けたフォームは対象外。
// 送信後に内容を書き直した場合(チャットで続けて送るなど)は、すぐ次の送信を受け付ける。
const LOCK_MS = 8000;

export function SubmitGuard() {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let hideTimer = 0;
    const onSubmit = (e: Event) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      if ((form.getAttribute("method") ?? "").toLowerCase() === "get" || form.hasAttribute("data-allow-resubmit")) return;
      const last = Number(form.dataset.submittedAt || 0);
      if (last && Date.now() - last < LOCK_MS) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      form.dataset.submittedAt = String(Date.now());
      form.setAttribute("aria-busy", "true");
      setBusy(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        form.removeAttribute("aria-busy");
        delete form.dataset.submittedAt;
        setBusy(false);
      }, LOCK_MS);
    };
    // 画面が切り替わったら(送信後の遷移)表示を消す
    const reset = () => {
      window.clearTimeout(hideTimer);
      setBusy(false);
      document.querySelectorAll<HTMLFormElement>("form[data-submitted-at]").forEach((f) => {
        delete f.dataset.submittedAt;
        f.removeAttribute("aria-busy");
      });
    };
    // 内容を書き直したら(チャットの次のメッセージなど)、すぐ次の送信を受け付ける
    const onEdit = (e: Event) => {
      if (!e.isTrusted) return;
      const form = (e.target as HTMLInputElement | null)?.form;
      if (form?.dataset.submittedAt) {
        delete form.dataset.submittedAt;
        form.removeAttribute("aria-busy");
        setBusy(false);
      }
    };
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("input", onEdit, true);
    window.addEventListener("pageshow", reset);
    window.addEventListener("popstate", reset);
    // Next.js のページ遷移(URL変化)でも消す
    let lastUrl = location.href;
    const urlTimer = window.setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        reset();
      }
    }, 300);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("input", onEdit, true);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("popstate", reset);
      window.clearInterval(urlTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!busy) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", left: 0, right: 0, margin: "0 auto", width: "fit-content",
        top: "calc(12px + env(safe-area-inset-top, 0px))", zIndex: 1100,
        background: "#1f2937", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 14,
        boxShadow: "0 4px 16px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: 10,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "ps-spin .8s linear infinite" }}
      />
      送信中です。そのままお待ちください…
      <style>{`@keyframes ps-spin{to{transform:rotate(360deg)}} form[aria-busy="true"] button[type="submit"], form[aria-busy="true"] button:not([type]){opacity:.6;cursor:progress}`}</style>
    </div>
  );
}
