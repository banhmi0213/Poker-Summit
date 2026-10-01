import type { Metadata } from "next";
import "./globals.css";
import { BackToTop } from "./back-to-top";

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
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;800;900&family=Noto+Serif+JP:wght@400;600;700&family=Allura&display=swap"
        />
      </head>
      <body>
        {children}
        <BackToTop />
      </body>
    </html>
  );
}
