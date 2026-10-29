import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

// 「ホーム画面に追加」でアプリのように全画面で開けるようにする(オーナー指示 2026/10/28: PWA)。
// アイコンはオーナーが選んだ見本「C NAVY」をそのまま切り出したもの(2026/10/30)。iPhone は角丸四角、Android は丸。
// 元の見本は assets/brand/app-icon-options-abc.png、切り出しは assets/brand/app-icon-ios-1024.png / app-icon-android-512.png。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#203c50",
    theme_color: "#0d1b28",
    lang: "ja",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
