"use client";

import { useState, type InputHTMLAttributes } from "react";

// パスワード欄(目のマークで表示/非表示を切り替え)。サイト・店舗管理・総合管理の共通部品(2026/10)
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const { style, ...rest } = props;
  return (
    <span style={{ position: "relative", display: "block", width: "100%" }}>
      <input {...rest} data-no-draft type={visible ? "text" : "password"} style={{ ...style, width: "100%", paddingRight: 44, boxSizing: "border-box" }} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "パスワードを隠す" : "パスワードを表示する"}
        aria-pressed={visible}
        title={visible ? "パスワードを隠す" : "パスワードを表示する"}
        style={{
          position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
          width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "none", cursor: "pointer", color: "#8a7656", padding: 0,
        }}
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  );
}
