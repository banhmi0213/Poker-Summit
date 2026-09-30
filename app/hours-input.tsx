"use client";

import { useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function formatHour(h: number) {
  return `${h}:00`;
}

// 既存の自由入力データ("18:00〜23:00" 等)をパースする。「24時間営業」
// 表記や、このパターンに一致しない過去の自由記述(スタッフが手入力した
// 表記ゆれ等)はフォールバックとして10:00〜22:00をデフォルト表示する
// (2026/09/30、営業時間を自由入力からこのプルダウン形式に変更した際の
// 移行措置。一度保存すると新フォーマットに置き換わり、自由記述は
// 復元できなくなる点に注意)。
function parseHours(value: string): { is24: boolean; start: number; end: number } {
  const trimmed = (value ?? "").trim();
  if (trimmed === "24時間営業" || trimmed === "24時間") {
    return { is24: true, start: 0, end: 0 };
  }
  const m = trimmed.match(/^(\d{1,2}):00\s*[〜~\-–]\s*(\d{1,2}):00$/);
  if (m) {
    const start = Number(m[1]);
    const end = Number(m[2]);
    if (start >= 0 && start <= 23 && end >= 0 && end <= 23) {
      return { is24: false, start, end };
    }
  }
  return { is24: false, start: 10, end: 22 };
}

/**
 * 営業時間の入力欄。自由入力のテキストボックスをやめて、開店/閉店を
 * 0:00〜23:00の24択プルダウンで選ぶ形式(+「24時間営業」チェックボックス)
 * にすることで、表記ゆれ(18:00-23:00 / 18時〜23時 等)をなくし統一する。
 *
 * サーバーアクション側(admin/stores/actions.ts の updateStoreByAdmin、
 * store/profile/actions.ts の店舗側更新)は今まで通り name="hours" の
 * 文字列を1つ受け取るだけで済むよう、隠しinputに組み立てた文字列を
 * 入れて送信する — フォーム側の見た目を変えるだけで、サーバー側・DB
 * スキーマは無改修で済む。
 */
export function HoursInput({ initialValue }: { initialValue: string | null | undefined }) {
  const parsed = parseHours(initialValue ?? "");
  const [is24, setIs24] = useState(parsed.is24);
  const [start, setStart] = useState(parsed.start);
  const [end, setEnd] = useState(parsed.end);

  const hoursValue = is24 ? "24時間営業" : `${formatHour(start)}〜${formatHour(end)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input type="hidden" name="hours" value={hoursValue} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
        <input type="checkbox" checked={is24} onChange={(e) => setIs24(e.target.checked)} />
        24時間営業
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select
          value={start}
          disabled={is24}
          onChange={(e) => setStart(Number(e.target.value))}
          aria-label="開店時刻"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {formatHour(h)}
            </option>
          ))}
        </select>
        <span className="muted">〜</span>
        <select
          value={end}
          disabled={is24}
          onChange={(e) => setEnd(Number(e.target.value))}
          aria-label="閉店時刻"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {formatHour(h)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
