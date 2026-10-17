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
    // 自動入力や復元で全角が入った場合も、送信の直前(ボタンを押す・Enter)に直す
    const fixForm = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Enter") return;
      const form = (e.target as Element | null)?.closest?.("form");
      form?.querySelectorAll<HTMLInputElement>('input[type="email"]').forEach((el) => fix({ target: el } as unknown as Event));
    };
    document.addEventListener("pointerdown", fixForm, true);
    document.addEventListener("keydown", fixForm, true);
    document.addEventListener("input", fix, true);
    document.addEventListener("compositionend", fix, true);
    document.addEventListener("change", fix, true);
    return () => {
      document.removeEventListener("pointerdown", fixForm, true);
      document.removeEventListener("keydown", fixForm, true);
      document.removeEventListener("input", fix, true);
      document.removeEventListener("compositionend", fix, true);
      document.removeEventListener("change", fix, true);
    };
  }, []);
  return null;
}
