"use client";
import { useEffect, useState } from "react";

// フォームを開いたときに1つ作る番号(2026/10/18)。同じ画面から2回送られても、
// サーバー側で「同じ申込み」と分かるようにする(二重の申込み・二重の請求書を防ぐ)。
export function RequestKeyInput({ name = "requestKey" }: { name?: string }) {
  const [key, setKey] = useState("");
  useEffect(() => {
    setKey(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  }, []);
  return <input type="hidden" name={name} value={key} />;
}
