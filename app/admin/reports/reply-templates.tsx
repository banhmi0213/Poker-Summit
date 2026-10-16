"use client";

// 返信欄によく使う文を入れるボタン(2026/10)
export function ReplyTemplates({ targetId, templates }: { targetId: string; templates: { label: string; text: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {templates.map((t) => (
        <button
          key={t.label}
          type="button"
          className="btn"
          style={{ fontSize: 12 }}
          onClick={() => {
            const ta = document.getElementById(targetId) as HTMLTextAreaElement | null;
            if (!ta) return;
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(ta, t.text);
            ta.dispatchEvent(new Event("input", { bubbles: true }));
            ta.focus();
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
