"use client";

import { useEffect, useRef, useState } from "react";

// メールアドレスと確認用の2回入力(2026/10)。ログイン情報が届く大事なアドレスなので、
// 一致しないときは送信前にブラウザで止める(入力した内容は消えない)。サーバー側でも再確認する。
export function ApplyEmailFields() {
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const confirmRef = useRef<HTMLInputElement>(null);
  const mismatch = confirm.length > 0 && email.trim().toLowerCase() !== confirm.trim().toLowerCase();
  useEffect(() => {
    confirmRef.current?.setCustomValidity(confirm && email.trim().toLowerCase() !== confirm.trim().toLowerCase() ? "メールアドレスが一致しません" : "");
  }, [email, confirm]);
  return (
    <>
      <div className="field">
        <span className="muted">メールアドレス *（店舗管理画面のログイン情報をお送りします）</span>
        <input type="email" name="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <span className="muted">メールアドレス（確認のため、もう一度入力） *</span>
        <input
          type="email"
          name="emailConfirm"
          required
          autoComplete="off"
          value={confirm}
          ref={confirmRef}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {mismatch && <span style={{ color: "var(--critical, #c0392b)", fontSize: 12 }}>メールアドレスが一致しません</span>}
      </div>
    </>
  );
}
