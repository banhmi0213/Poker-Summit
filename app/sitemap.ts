import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

// Regenerate hourly so newly approved stores and blog posts appear without a redeploy.
export const revalidate = 3600;

const PUBLIC_STORE_STATUSES = ["approved", "listed"];
const PAGE_SIZE = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
 const base=process.env.NEXT_PUBLIC_SITE_URL || "https://poker-summit.vercel.app";
 const supabase=await createClient();
 const now=new Date();

 const fixed=["","/stores","/events","/jobs","/major-tournaments","/blog"].map(path=>({url:`${base}${path}`,lastModified:now}));

 const {data:blogData}=await supabase.from("blog_entries").select("id,slug,updated_at").eq("active",true).eq("include_in_sitemap",true).eq("search_index",true);
 const blog=(blogData||[]).map(entry=>({url:`${base}/blog/${entry.slug||entry.id}`,lastModified:entry.updated_at?new Date(entry.updated_at):now}));

 // Same visibility rule as app/stores/[id]/page.tsx. Paged so it keeps working past Supabase's 1,000-row limit.
 const stores:MetadataRoute.Sitemap=[];
 for(let from=0;;from+=PAGE_SIZE){
  const {data,error}=await supabase.from("stores").select("id,updated_at").in("status",PUBLIC_STORE_STATUSES).order("id").range(from,from+PAGE_SIZE-1);
  if(error){console.error("sitemap: failed to load stores",error.message);break;}
  if(!data||data.length===0)break;
  for(const store of data){
   stores.push({url:`${base}/stores/${store.id}`,lastModified:store.updated_at?new Date(store.updated_at):now});
  }
  if(data.length<PAGE_SIZE)break;
 }

 return [...fixed,...stores,...blog];
}
