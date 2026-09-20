import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Summit",
  description: "全国のポーカースポットを探せるポータルサイト",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
