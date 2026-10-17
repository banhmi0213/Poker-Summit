"use client";

import { useEffect } from "react";

// メールアドレス欄に全角文字(＋ ＠ ． 全角英数字など)が入ったら、その場で半角に直す(2026/10)。
// 日本語入力のまま「＋」「＠」を打つと、ブラウザが正しいメールアドレスと認めず
// ログイン・登録ボタン(Enter含む)が反応しないように見えるため。サイト全体の type="email" 欄が対象。
export function EmailNormalizer() {
  useEffect(() => {
    const fix = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || el.type !== "email") return;
      if ((e as InputEvent).isComposing) return;
      const next = el.value.normalize("NFKC").replace(/\s/g, "");
      if (next === el.value) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, next);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.addEventListener("input", fix, true);
    document.addEventListener("compositionend", fix, true);
    document.addEventListener("change", fix, true);
    return () => {
      document.removeEventListener("input", fix, true);
      document.removeEventListener("compositionend", fix, true);
      document.removeEventListener("change", fix, true);
    };
  }, []);
  return null;
}
