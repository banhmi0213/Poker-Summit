import "server-only";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "./supabase/anon";
import { NEWS_CATEGORIES,newsSearchText,validNewsDate } from "./poker-news-input";
export type PokerNews={id:string;title:string;summary:string;category:string;source_url:string;source_label:string;news_date:string;related_blog_id:string|null;relatedHref?:string};
export async function getPokerNews(options:{page?:number;category?:string;date?:string;q?:string}={}){
 const supabase=createAnonClient();const page=Math.max(1,Math.min(10000,Math.floor(options.page||1)));
 let query=supabase.from("poker_news").select("id,title,summary,category,source_url,source_label,news_date,related_blog_id",{count:"exact"}).eq("active",true);
 if(options.category&&NEWS_CATEGORIES.some(x=>x===options.category))query=query.eq("category",options.category);
 if(options.date&&validNewsDate(options.date))query=query.eq("news_date",options.date);
 const q=newsSearchText(options.q||"");if(q)query=query.or(`title.ilike.%${q}%,summary.ilike.%${q}%`);
 const {data,error,count}=await query.order("news_date",{ascending:false}).order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*10,page*10-1);
 if(error)throw error;
 const entries=(data||[]) as PokerNews[];const ids=[...new Set(entries.map(x=>x.related_blog_id).filter(Boolean))] as string[];
 if(ids.length){const {data:blogs,error:blogError}=await supabase.from("blog_entries").select("id,slug").in("id",ids).eq("active",true);if(blogError)throw blogError;const links=new Map((blogs||[]).map(x=>[x.id,`/blog/${x.slug||x.id}`]));for(const entry of entries)entry.relatedHref=links.get(entry.related_blog_id||"");}
 return {entries,count:count||0,page};
}
export const getHomePokerNews=unstable_cache(()=>getPokerNews(),["home-poker-news-v1"],{revalidate:60,tags:["public-stores"]});
