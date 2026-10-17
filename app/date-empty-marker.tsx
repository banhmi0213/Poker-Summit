"use client";

import { useEffect } from "react";

// 日付・日時の入力欄が空のとき data-empty を付ける(2026/10)。
// iPhoneのSafariは空の日付欄に何も表示せず、押せる欄だと分かりにくいため、
// CSS側で「日付を選ぶ」「日時を選ぶ」を薄く表示する(globals.css参照)。
const SELECTOR = 'input[type="date"], input[type="datetime-local"]';

export function DateEmptyMarker() {
  useEffect(() => {
    const mark = (el: Element) => {
      if (!(el instanceof HTMLInputElement) || !el.matches(SELECTOR)) return;
      if (el.value) el.removeAttribute("data-empty");
      else el.setAttribute("data-empty", "");
    };
    const scan = (root: ParentNode = document) => root.querySelectorAll(SELECTOR).forEach(mark);
    const onEvent = (e: Event) => { if (e.target instanceof Element) mark(e.target); };
    const onReset = (e: Event) => { const form = e.target as HTMLFormElement; setTimeout(() => scan(form), 0); };
    scan();
    const timer = setTimeout(() => scan(), 400); // 下書きの復元などが終わったあとにもう一度
    const observer = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => { if (n instanceof Element) { mark(n); scan(n); } });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", onEvent, true);
    document.addEventListener("change", onEvent, true);
    document.addEventListener("blur", onEvent, true);
    document.addEventListener("reset", onReset, true);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("input", onEvent, true);
      document.removeEventListener("change", onEvent, true);
      document.removeEventListener("blur", onEvent, true);
      document.removeEventListener("reset", onReset, true);
    };
  }, []);
  return null;
}
