"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" disabled={pending} aria-busy={pending} style={{ width: "100%" }}>
      {pending ? "ログイン中…" : "ログイン"}
    </button>
  );
}

export function ManagementLoginForm({ action, children }: {
  action: (data: FormData) => Promise<void>;
  children: ReactNode;
}) {
  function handleEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (!(event.target instanceof HTMLInputElement)) return;
    const button = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]');
    event.preventDefault();
    if (button && !button.disabled) event.currentTarget.requestSubmit(button);
  }

  return (
    <form action={action} onKeyDown={handleEnter}>
      {children}
      <LoginButton />
    </form>
  );
}
