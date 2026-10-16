"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Google アナリティクスのページ表示の計測(2026/10)。
// 総合管理・店舗管理・ログイン画面など運営・お店の作業ページは数えない(アクセス数に混ぜない)。
// 自動のページ表示計測(gtag の send_page_view・GA側の「履歴の変化で計測」)は切り、ここから送る。
const EXCLUDE = /^\/(admin|admin-login|store\/|store$|api\/|auth\/|liff)/;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function GaPageView({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    // 管理画面にいる間は、スクロール・フォーム操作などの自動計測も含めて送らない
    (window as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = !!pathname && EXCLUDE.test(pathname);
    if (!pathname || EXCLUDE.test(pathname)) return;
    // ページのタイトルが入れ替わるのを少し待ってから送る
    const t = window.setTimeout(() => {
      window.gtag?.("event", "page_view", {
        send_to: measurementId,
        page_location: window.location.href,
        page_path: pathname,
        page_title: document.title,
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [pathname, searchParams, measurementId]);
  return null;
}
