"use client";

// 下までスクロールしたら出てくる「トップに戻る」ボタン(2026/10/01追加)。
// 全ページ共通で出したいので、個別ページではなく app/layout.tsx から
// 一度だけ読み込む。表示/非表示の切り替えに state が要るので
// "use client" が必須(サーバーコンポーネントの layout.tsx からは
// クライアントコンポーネントとしてそのまま呼び出せる)。

import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 400;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="ページの先頭に戻る"
      className="back-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ↑
    </button>
  );
}
