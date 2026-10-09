"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// 送信中は押せなくするボタン(決済を伴うフォームの二重送信防止)。
export function PendingSubmitButton({
  children,
  pendingLabel = "処理中…",
  className = "btn primary",
  style,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} style={style} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
