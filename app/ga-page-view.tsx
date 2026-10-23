"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { visitSource } from "@/lib/visit-source";

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
    // 運営の端末(総合管理を開いたことがある端末、ps_staff=1)はどのページも数えない(2026/10/21)
    const staff = /(^|; )ps_staff=1/.test(document.cookie);
    (window as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = staff || (!!pathname && EXCLUDE.test(pathname));
    if (staff || !pathname || EXCLUDE.test(pathname)) return;
    // ページのタイトルが入れ替わるのを少し待ってから送る
    const t = window.setTimeout(() => {
      // サイト全体のPV・UUを総合管理でも見られるよう、自分のサイトにも送る(2026/10/21、/api/pv)
      try {
        // 宣伝リンクの目印(?utm_source=x&utm_campaign=...)も送る。最初に来たときの目印は30日間覚えておき、
        // 会員登録したときにどの宣伝から来た人か分かるようにする(Cookie ps_src、2026/10/23)
        const src = visitSource(searchParams?.get("utm_source"), searchParams?.get("utm_campaign"));
        if (src && !/(^|; )ps_src=/.test(document.cookie)) document.cookie = `ps_src=${encodeURIComponent(src)}; path=/; max-age=${30 * 24 * 3600}; samesite=lax; secure`;
        const payload = JSON.stringify({ path: pathname, ref: document.referrer || "", src: src || "" });
        if (!navigator.sendBeacon?.("/api/pv", new Blob([payload], { type: "application/json" }))) {
          void fetch("/api/pv", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
        }
      } catch {
        // 送れなくても何もしない
      }
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
