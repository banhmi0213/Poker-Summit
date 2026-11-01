import { StoreGuide } from "@/app/store-guide/guide";

// 店舗管理の中の「店舗管理ガイド」(2026/10/22)。ログインした店舗だけが見られる。
export default function StoreGuidePage() {
  return (
    <div style={{ maxWidth: 820 }}>
      <StoreGuide />
    </div>
  );
}
