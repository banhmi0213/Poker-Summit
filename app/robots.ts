import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { AI_CRAWLERS } from "@/lib/scrape-watch";


export default function robots(): MetadataRoute.Robots {
 const base=SITE_URL;
 return {
  rules:[
   // AI crawlers that collect pages for model training or AI answers: not allowed anywhere (owner 2026/10/30:
   // こっちの中身がAIに覗かれんように). Search engines (Googlebot, Bingbot …) keep the normal rule below.
   // Crawlers that ignore this are recorded and reported to the owner (middleware → /api/security/scrape-hit).
   {userAgent:AI_CRAWLERS,disallow:"/"},
   {
    userAgent:"*",
    allow:"/",
    // Logged-in areas, dashboards and APIs have nothing for search engines.
    disallow:["/admin","/admin-login","/account","/mypage","/store$","/store/","/matching$","/matching/","/liff","/api/"],
   },
  ],
  sitemap:`${base}/sitemap.xml`,
 };
}
