import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
 const base=process.env.NEXT_PUBLIC_SITE_URL || "https://poker-summit.vercel.app";
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
