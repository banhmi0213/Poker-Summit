import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { CITY_PAGE_MIN_STORES, cityPageHref, cityPageKeys } from "@/lib/city";
import { createClient } from "@/lib/supabase/server";

// Regenerate hourly so newly approved stores and blog posts appear without a redeploy.
export const revalidate = 3600;

const PUBLIC_STORE_STATUSES = ["approved", "listed"];
const PAGE_SIZE = 1000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
 const base=SITE_URL;
 const supabase=await createClient();
 const now=new Date();

 const fixed=["","/stores","/events","/jobs","/coupons","/board","/major-tournaments","/blog","/apply","/company"].map(path=>({url:`${base}${path}`,lastModified:now}));

 const {data:blogData}=await supabase.from("blog_entries").select("id,slug,updated_at").eq("active",true).eq("include_in_sitemap",true).eq("search_index",true);
 const blog=(blogData||[]).map(entry=>({url:`${base}/blog/${entry.slug||entry.id}`,lastModified:entry.updated_at?new Date(entry.updated_at):now}));

 // Same visibility rule as app/stores/[id]/page.tsx. Paged so it keeps working past Supabase's 1,000-row limit.
 const stores:MetadataRoute.Sitemap=[];
 const storeRows:{pref:string|null;city:string|null;updated_at:string|null}[]=[];
 for(let from=0;;from+=PAGE_SIZE){
  const {data,error}=await supabase.from("stores").select("id,pref,city,updated_at").in("status",PUBLIC_STORE_STATUSES).order("id").range(from,from+PAGE_SIZE-1);
  if(error){console.error("sitemap: failed to load stores",error.message);break;}
  if(!data||data.length===0)break;
  for(const store of data){
   storeRows.push({pref:store.pref,city:store.city,updated_at:store.updated_at});
   stores.push({url:`${base}/stores/${store.id}`,lastModified:store.updated_at?new Date(store.updated_at):now});
  }
  if(data.length<PAGE_SIZE)break;
 }

 // 掲載店舗がある都道府県の一覧ページ(/stores?pref=東京都)。店舗一覧ページと同じcanonical形式。
 const prefLatest=new Map<string,number>();
 for(const store of storeRows){
  if(!store.pref)continue;
  const t=store.updated_at?new Date(store.updated_at).getTime():now.getTime();
  prefLatest.set(store.pref,Math.max(prefLatest.get(store.pref)??0,t));
 }
 const prefPages=Array.from(prefLatest,([pref,t])=>({url:`${base}/stores?pref=${encodeURIComponent(pref)}`,lastModified:new Date(t)}));

 // 市区町村ページ(/stores/area/東京都/新宿区)。店舗が一定数以上ある市区町村だけ。
 // 新しい店舗が登録されると自動でここに加わる。
 const cityStats=new Map<string,{pref:string;city:string;n:number;t:number}>();
 for(const store of storeRows){
  if(!store.pref)continue;
  const t=store.updated_at?new Date(store.updated_at).getTime():now.getTime();
  for(const city of cityPageKeys(store.city)){
   const key=`${store.pref}\t${city}`;
   const cur=cityStats.get(key)??{pref:store.pref,city,n:0,t:0};
   cur.n++;cur.t=Math.max(cur.t,t);cityStats.set(key,cur);
  }
 }
 const cityPages=Array.from(cityStats.values()).filter(c=>c.n>=CITY_PAGE_MIN_STORES).map(c=>({url:`${base}${cityPageHref(c.pref,c.city)}`,lastModified:new Date(c.t)}));

 const today=now.toISOString().slice(0,10);
 const [{data:events},{data:jobs},{data:coupons},{data:tournaments}]=await Promise.all([
  supabase.from("events").select("id,updated_at,start_at,end_at,stores(status)").eq("status","published"),
  supabase.from("jobs").select("id,updated_at,stores(status)").eq("status","open"),
  supabase.from("coupons").select("id,updated_at,valid_until,stores(status)").eq("active",true),
  supabase.from("major_tournaments").select("id,updated_at").eq("active",true),
 ]);
 const listed=(row:any)=>{const st=Array.isArray(row.stores)?row.stores[0]:row.stores;return !st||PUBLIC_STORE_STATUSES.includes(st.status);};
 const lm=(v:string|null|undefined)=>v?new Date(v):now;
 const eventPages=(events||[]).filter(listed).map((e:any)=>({url:`${base}/events/${e.id}`,lastModified:lm(e.updated_at)}));
 const jobPages=(jobs||[]).filter(listed).map((j:any)=>({url:`${base}/jobs/${j.id}`,lastModified:lm(j.updated_at)}));
 const couponPages=(coupons||[]).filter(listed).filter((c:any)=>!c.valid_until||c.valid_until>=today).map((c:any)=>({url:`${base}/coupons/${c.id}`,lastModified:lm(c.updated_at)}));
 const tournamentPages=(tournaments||[]).map((t:any)=>({url:`${base}/major-tournaments/${t.id}`,lastModified:lm(t.updated_at)}));

 return [...fixed,...prefPages,...cityPages,...stores,...eventPages,...jobPages,...couponPages,...tournamentPages,...blog];
}
