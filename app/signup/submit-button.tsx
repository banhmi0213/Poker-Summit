"use client";

import { useFormStatus } from "react-dom";

// 送信中はボタンを押せなくする(連打で確認メールが何通も届かないように)
export function SignupSubmitButton({ className, label }: { className?: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? "送信中…" : label} {!pending && <span aria-hidden="true">→</span>}
    </button>
  );
}
