"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

// 通報ボタン(2026/10)。押すと理由の選択と詳しい内容の欄が開き、送ると運営の「通報管理」に届く。
// 以前は押すだけで「ユーザーからの通報」とだけ記録され、運営が何の問題か分からなかった。
export const REPORT_REASONS: Record<"store" | "job" | "post" | "reply", string[]> = {
  store: ["閉店・休業している", "住所・電話番号・営業時間などが違う", "ポーカー店ではない・重複している", "違法・不適切な内容がある", "その他"],
  job: ["応募しても連絡がない", "求人の内容が事実と違う", "違法・不適切な求人", "その他"],
  post: ["誹謗中傷・嫌がらせ", "スパム・宣伝", "個人情報が書かれている", "違法・不適切な内容", "その他"],
  reply: ["誹謗中傷・嫌がらせ", "スパム・宣伝", "個人情報が書かれている", "違法・不適切な内容", "その他"],
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn primary" disabled={pending} style={{ fontSize: 12.5 }}>
      {pending ? "送信中…" : "運営に送る"}
    </button>
  );
}

export function ReportForm({
  kind,
  action,
  label = "通報",
  buttonStyle,
}: {
  kind: "store" | "job" | "post" | "reply";
  action: (formData: FormData) => Promise<void>;
  label?: string;
  buttonStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <span className="muted" style={{ fontSize: 12.5 }}>運営に送りました。ご協力ありがとうございます。</span>;
  if (!open) {
    return (
      <button type="button" className="btn" style={{ fontSize: 12.5, ...buttonStyle }} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  return (
    <form
      action={async (fd) => {
        await action(fd);
        setDone(true);
      }}
      className="card"
      style={{ display: "grid", gap: 8, padding: 12, margin: "8px 0", width: "100%", maxWidth: 420, textAlign: "left" }}
    >
      <strong style={{ fontSize: 13.5 }}>どんな問題がありますか？</strong>
      <select name="reason" required defaultValue="" style={{ fontSize: 14 }}>
        <option value="" disabled>
          選んでください
        </option>
        {REPORT_REASONS[kind].map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <textarea
        name="detail"
        rows={3}
        maxLength={1000}
        placeholder="詳しい内容（任意）。例：〇月に閉店した、電話番号が違う など"
        style={{ fontSize: 14 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <SubmitButton />
        <button type="button" className="btn" style={{ fontSize: 12.5 }} onClick={() => setOpen(false)}>
          やめる
        </button>
      </div>
    </form>
  );
}
