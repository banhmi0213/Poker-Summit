import { NextRequest } from "next/server";
import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { getNewsLinkPreview,publicHttpsUrl } from "@/lib/news-link-preview";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
// Only already-published news URLs can be fetched here. No arbitrary URL input.
const cachedPreview=unstable_cache(getNewsLinkPreview,["public-news-link-preview-v1"],{revalidate:3600,tags:["public-stores"]});
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get("id")||"";
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))return new Response(null,{status:404});
 const {data,error}=await createAnonClient().from("poker_news").select("source_url,thumbnail_mode,thumbnail_url").eq("id",id).eq("active",true).maybeSingle();
 if(error||!data||data.thumbnail_mode==="none")return new Response(null,{status:404});
 const image=data.thumbnail_url||(data.thumbnail_mode==="auto"?(await cachedPreview(data.source_url)).imageUrl:"");
 if(!image)return new Response(null,{status:404,headers:{"Cache-Control":"public,max-age=300"}});
 try{return new Response(null,{status:307,headers:{"Location":publicHttpsUrl(image).href,"Cache-Control":"public,max-age=300","Referrer-Policy":"no-referrer"}});}catch{return new Response(null,{status:404});}
}

