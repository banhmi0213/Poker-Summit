"use client";

import Link from "next/link";
import { ADMIN_ATTENTION_ITEMS, useAttentionCounts } from "@/app/attention-counts";

// ダッシュボード上部の「対応が必要なこと」(2026/10)。メニューの赤い数字の中身を言葉で並べ、押すとその画面へ。
export function AttentionSummary() {
  const counts = useAttentionCounts("admin");
  const items = ADMIN_ATTENTION_ITEMS.filter((i) => (counts[i.key] ?? 0) > 0);
  if (items.length === 0) {
    return (
      <div className="card" style={{ marginBottom: 18, fontSize: 13.5 }}>
        ✓ 今、対応が必要なことはありません。
      </div>
    );
  }
  return (
    <div className="card" style={{ marginBottom: 18, borderLeft: "4px solid #aa3b28" }}>
      <strong style={{ fontSize: 15 }}>対応が必要なこと</strong>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
        {items.map((i) => (
          <li key={i.key}>
            <Link href={i.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, background: "#faf6ec", textDecoration: "none", color: "inherit" }}>
              <span>{i.label}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                <span style={{ background: "#aa3b28", color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 12.5 }}>{counts[i.key]}件</span>

              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
