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
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;800;900&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
