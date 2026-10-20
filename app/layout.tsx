import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGES, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";
import "./globals.css";
import "./admin/major-tournaments/tournament.css";
import "./spacing.css";
import "./pc-readability.css";
import "./mobile-readability.css";
import { BackToTop } from "./back-to-top";
import { ImageUploadCompressor } from "./image-upload-compressor";
import { FormDraftKeeper } from "./form-draft-keeper";
import { EmailNormalizer } from "./email-normalizer";
import { DateEmptyMarker } from "./date-empty-marker";
import { SubmitGuard } from "./submit-guard";
import Script from "next/script";
import { Suspense } from "react";
import { GaPageView } from "./ga-page-view";

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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        {/* 他のドメインがこのサイトを丸ごと映して(プロキシ・コピー)公開している場合に、本物の pokersummit.jp へ戻す(2026/10/20。
            Googleがトップを別ドメインの重複と判断していたため)。ドメイン名は書き換えられないよう符号化して比べる。
            プレビュー環境(*.vercel.app)・開発環境では何もしない */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var h=location.hostname,o=atob("cG9rZXJzdW1taXQuanA=");if(h&&h!==o&&h!=="localhost"&&h!=="127.0.0.1"&&!/\\.vercel\\.app$/.test(h)){location.replace("https://"+o+location.pathname+location.search+location.hash)}}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Noto+Serif+JP:wght@400;600;700&family=Allura&display=swap"
        />
      </head>
      <body>
        {children}
        <BackToTop />
        <ImageUploadCompressor />
        <FormDraftKeeper />
        <EmailNormalizer />
        <DateEmptyMarker />
        <SubmitGuard />
        {ENABLE_ANALYTICS && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="beforeInteractive">
              {`if(/^\\/(admin|admin-login|store\\/|store$|api\\/|auth\\/|liff)/.test(location.pathname))window['ga-disable-${GA_MEASUREMENT_ID}']=true;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:false});`}
            </Script>
            {/* ページ表示はここから送る(管理画面は数えない) */}
            <Suspense fallback={null}>
              <GaPageView measurementId={GA_MEASUREMENT_ID} />
            </Suspense>
          </>
        )}
      </body>
    </html>
  );
}
