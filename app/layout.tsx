import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";
import "./globals.css";
import "./admin/major-tournaments/tournament.css";
import { BackToTop } from "./back-to-top";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME}｜${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    locale: "ja_JP",
    type: "website",
    title: `${SITE_NAME}｜${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
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
