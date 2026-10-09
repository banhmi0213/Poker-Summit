"use client";

import { useId, useState } from "react";

export function CopyLoginField({ label, value, width }: { label: string; value: string; width: number }) {
  const [message, setMessage] = useState("");
  const id = useId();
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("コピーしました");
    } catch {
      setMessage("コピーできませんでした。入力欄の文字を選択してコピーしてください。");
    }
  }
  return <div style={{ maxWidth: "100%" }}>
    <label htmlFor={id} className="muted" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>{label}</label>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <input id={id} readOnly value={value} style={{ width, maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }} />
    <button type="button" onClick={copy} aria-label={`${label}をコピー`} title={`${label}をコピー`} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44, flexShrink: 0, padding: "8px 12px", background: "#fffaf0", color: "#614010", border: "1px solid #d7be96", borderRadius: 6, cursor: "pointer" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></svg>
      コピー
    </button>
    </div>
    <span role="status" style={{ display: "block", fontSize: 12, marginTop: 4 }}>{message}</span>
  </div>;
}
