import type { ReactNode } from "react";
import type { Metadata } from "next";

// 公開の会員登録・ログイン入口は検索対象。認証後のページは各専用レイアウトでnoindex。
export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
