"use client";

import { PasswordInput } from "@/app/password-input";

import { useFormStatus } from "react-dom";
import { signIn } from "./actions";

// 送信中はボタンを押せなくし「ログイン中…」と出す(Enterの連打で失敗回数が増えないように)
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" style={{ width: "100%" }} disabled={pending} aria-busy={pending}>
      {pending ? "ログイン中…" : "ログイン"}
    </button>
  );
}

export function MemberLoginForm({ next }: { next: string }) {
  return <form action={signIn} onKeyDown={event => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (!(event.target instanceof HTMLInputElement) || !["email", "password"].includes(event.target.name)) return;
    event.preventDefault();
    const submit = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submit?.disabled) return;
    event.currentTarget.requestSubmit();
  }}>
    <input type="hidden" name="next" value={next} />
    <label className="field"><span>メールアドレス</span><input type="email" name="email" required autoComplete="username email" /></label>
    <label className="field"><span>パスワード</span><PasswordInput name="password" required enterKeyHint="go" autoComplete="current-password" /></label>
    <SubmitButton />
  </form>;
}
