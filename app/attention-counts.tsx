"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// 総合管理・店舗管理のメニューの「未対応・未確認」件数を取ってくる(2026/10)。
// ページを移るたび・30秒ごと・タブに戻ったとき・"attention-changed" イベントで読み直す。
export function useAttentionCounts(scope: "admin" | "store") {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/attention?scope=${scope}`, { cache: "no-store" });
        if (res.ok && active) setCounts(await res.json());
      } catch {
        /* 取れなければ印を出さないだけ */
      }
    };
    load();
    const timer = setInterval(load, 30000);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("attention-changed", load);
    // 対応済みにする等の保存(フォーム送信)のあとにも読み直す
    let submitTimer = 0;
    const onSubmit = () => {
      window.clearTimeout(submitTimer);
      submitTimer = window.setTimeout(load, 1500);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => {
      window.clearTimeout(submitTimer);
      document.removeEventListener("submit", onSubmit, true);
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("attention-changed", load);
    };
  }, [scope, pathname]);
  return counts;
}

export function CountBadge({ count, label }: { count: number | undefined; label?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span
      role="status"
      aria-label={`${label ?? "未対応"} ${count}件`}
      style={{
        display: "inline-block",
        marginLeft: 8,
        padding: "2px 8px",
        borderRadius: 20,
        background: "#aa3b28",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.4,
        verticalAlign: "middle",
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
