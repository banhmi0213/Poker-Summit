"use client";
import { useEffect } from "react";

// 既読にした直後、メニューの件数の印をすぐ読み直させる
export function MarkMessagesRead() {
  useEffect(() => {
    window.dispatchEvent(new Event("attention-changed"));
  }, []);
  return null;
}
