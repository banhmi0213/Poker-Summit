"use client";
import { useEffect } from "react";

// ホーム画面に追加したときにアプリとして扱われるよう、service worker を登録する(ページの中身は一切キャッシュしない)。
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
