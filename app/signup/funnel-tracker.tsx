"use client";

import { useEffect } from "react";

// 先行登録ページで、どこで離れているかを測る(2026/10/19)。
// 「登録へ」ボタンを押した / フォームに入力し始めた / 登録ボタンを押した を1回ずつ記録する。
// 個人情報(入力内容)は送らない。
function send(event: string) {
  try {
    const body = JSON.stringify({ event });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/prelaunch-event", new Blob([body], { type: "application/json" }));
    else fetch("/api/prelaunch-event", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // 記録に失敗しても登録には影響させない
  }
}

export function SignupFunnelTracker({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const sent = new Set<string>();
    const once = (e: string) => {
      if (sent.has(e)) return;
      sent.add(e);
      send(e);
    };
    const onFocus = () => once("form_start");
    const onSubmit = () => once("submit");
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as HTMLElement | null)?.closest?.('a[href="#signup-form"]');
      if (a) once("cta_click");
    };
    form.addEventListener("focusin", onFocus);
    form.addEventListener("submit", onSubmit);
    document.addEventListener("click", onClick);
    return () => {
      form.removeEventListener("focusin", onFocus);
      form.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", onClick);
    };
  }, [formId]);
  return null;
}
