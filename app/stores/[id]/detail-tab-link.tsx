"use client";
import { createContext, useContext } from "react";

export const StoreDetailViewContext = createContext(false);

export function DetailTabLink({ id }: { id: string }) {
  const expanded = useContext(StoreDetailViewContext);
  if (expanded) return null;
  return <button className="sd-see-all" type="button" onClick={() => window.dispatchEvent(new CustomEvent("store-detail-tab", { detail: id }))}>すべて見る ›</button>;
}
