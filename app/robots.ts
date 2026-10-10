import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
 const base=SITE_URL;
 return {
  rules:[
   {
    userAgent:"*",
    allow:"/",
    // Logged-in areas, dashboards and APIs have nothing for search engines.
    disallow:["/admin","/admin-login","/account","/mypage","/store$","/store/","/matching$","/matching/","/login","/signup","/liff","/api/"],
   },
  ],
  sitemap:`${base}/sitemap.xml`,
 };
}
