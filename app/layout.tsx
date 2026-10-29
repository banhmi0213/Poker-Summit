import type { Metadata, Viewport } from "next";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGES, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";
import "./globals.css";
import "./admin/major-tournaments/tournament.css";
import "./spacing.css";
import { BackToTop } from "./back-to-top";
import { ImageUploadCompressor } from "./image-upload-compressor";
import { FormDraftKeeper } from "./form-draft-keeper";
import Script from "next/script";
import { ServiceWorkerRegister } from "./service-worker-register";

// Google アナリティクス(GA4、2026/10)。本番(pokersummit.jp)だけで計測し、プレビュー環境では読み込まない。
const GA_MEASUREMENT_ID = "G-M5QMYFSCHJ";
const ENABLE_ANALYTICS = process.env.VERCEL_ENV === "production";

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
    images: DEFAULT_OG_IMAGES,
  },
  twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE] },
  // Google Search Console の所有権確認(2026/10)。確認後も消さないこと(消すと確認が外れる)
  verification: { google: "v-vQFn2rvqxcBghuEN-zxIqLPHhekhHJkCHDVuPbF3M" },
  // ホーム画面に追加したとき(iPhone)の名前と全画面表示(2026/10/28 PWA)
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "black" },
};

export const viewport: Viewport = { themeColor: "#0d1b28" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700;800;900&family=Noto+Serif+JP:wght@400;600;700&family=Allura&display=swap"
        />
      </head>
      <body>
        {children}
        <BackToTop />
        <ImageUploadCompressor />
        <FormDraftKeeper />
        <ServiceWorkerRegister />
        {ENABLE_ANALYTICS && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
