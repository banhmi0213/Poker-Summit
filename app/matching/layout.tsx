import type { ReactNode } from "react";
import { NOINDEX } from "@/lib/seo";

// ログインが必要な画面・会員/店舗専用の画面は検索結果に出さない
export const metadata = NOINDEX;

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
