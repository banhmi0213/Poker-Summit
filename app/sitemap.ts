import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
 const base=process.env.NEXT_PUBLIC_SITE_URL || "https://poker-summit.vercel.app";
 const supabase=await createClient();
 const {data}=await supabase.from("blog_entries").select("id,slug,updated_at").eq("active",true).eq("include_in_sitemap",true);
 const fixed=["","/blog","/stores","/events"].map(path=>({url:`${base}${path}`,lastModified:new Date()}));
 const blog=(data||[]).map(entry=>({url:`${base}/blog/${entry.slug||entry.id}`,lastModified:entry.updated_at?new Date(entry.updated_at):new Date()}));
 return [...fixed,...blog];
}
