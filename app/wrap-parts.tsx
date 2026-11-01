"use client";
import { useLayoutEffect, useRef, type CSSProperties } from "react";

// 見出しを区切りごとに折り返すとき、行末に来た「・」を隠す(2026/10/26 オーナー指示)。
// 改行していれば「・」はいらない。同じ行に続くときは「・」を残す。
// 文字としては「・」を残す(検索エンジン・読み上げ用)。visibility で隠すので幅は変わらず、折り返し位置も動かない。
export function WrapParts({ parts, className, style }: { parts: string[]; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const update = () => {
      const words = Array.from(root.querySelectorAll<HTMLElement>("[data-part]"));
      words.forEach((word, i) => {
        const dot = word.querySelector<HTMLElement>("[data-dot]");
        const next = words[i + 1];
        if (!dot || !next) return;
        const dotTop = dot.getBoundingClientRect().top;
        const nextTop = next.getClientRects()[0]?.top ?? dotTop;
        dot.style.visibility = nextTop > dotTop + 2 ? "hidden" : "";
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [parts]);
  return <span ref={ref}>{parts.map((part, i) => {
    const dot = part.endsWith("・") && i < parts.length - 1;
    return <span key={i} data-part className={className} style={style}>{dot ? <>{part.slice(0, -1)}<span data-dot>・</span></> : part}</span>;
  })}</span>;
}
