"use client";

import { signIn } from "./actions";

export function MemberLoginForm({ next }: { next: string }) {
  return <form action={signIn} onKeyDown={event => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (!(event.target instanceof HTMLInputElement) || !["email", "password"].includes(event.target.name)) return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }}>
    <input type="hidden" name="next" value={next} />
    <label className="field"><span>メールアドレス</span><input type="email" name="email" required autoComplete="email" /></label>
    <label className="field"><span>パスワード</span><input type="password" name="password" required enterKeyHint="go" autoComplete="current-password" /></label>
    <button type="submit" className="btn primary" style={{ width: "100%" }}>ログイン</button>
  </form>;
}
