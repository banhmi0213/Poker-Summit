import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "./supabase/anon";
import type { BlogEntry } from "./blog";

export type HomeBlogEntry = Pick<BlogEntry, "id" | "slug" | "title" | "category" | "image_url" | "image_alt" | "created_at" | "content_mode" | "article_url">;

export async function loadHomeBlogEntries(): Promise<HomeBlogEntry[]> {
 const supabase=createAnonClient();
 const entries:HomeBlogEntry[]=[];
 // Fetch metadata only, including older pages rather than silently truncating the rail.
 const batch=500;
 for(let start=0;;start+=batch){
  const {data,error}=await supabase.from("blog_entries")
   .select("id,slug,title,category,image_url,image_alt,created_at,content_mode,article_url")
   .eq("active",true).order("created_at",{ascending:false}).order("id",{ascending:false})
   .range(start,start+batch-1);
  if(error)throw error;
  entries.push(...(data || []) as HomeBlogEntry[]);
  if(!data || data.length<batch)return entries;
 }
}

// Blog save/delete already invalidates this shared public-data tag.
export const getHomeBlogEntries=unstable_cache(loadHomeBlogEntries,["home-blog-entries-v1"],{revalidate:60,tags:["public-stores"]});
