"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/audit";
import { BLOG_CATEGORIES, type BlogBlock } from "@/lib/blog";
type State = {error?:string;success?:string;id?:string;body?:BlogBlock[];imageUrl?:string};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function saveBlogEntry(_state:State,formData:FormData):Promise<State> {
 const supabase = await createClient();
 const {data:{user}} = await supabase.auth.getUser();
 if(!user) return {error:"管理者ログインが必要です。"};
 const {data:admin,error:authError} = await supabase.rpc("is_admin");
 if(authError || admin !== true) return {error:"運営権限がありません。"};
 const id = String(formData.get("id") || "");
 if(id && !uuid.test(id)) return {error:"記事が見つかりません。"};
 const title=String(formData.get("title") || "").trim();
 const imageAlt=String(formData.get("imageAlt") || "").trim();
 if(imageAlt.length>300) return {error:"メイン画像のALTは300文字以内で入力してください。"};
 const summary=String(formData.get("summary") || "").trim();
 const metaDescription=String(formData.get("metaDescription") || "").trim();
 if(metaDescription.length>300) return {error:"メタディスクリプションは300文字以内で入力してください。"};
 const category=String(formData.get("category") || "");
 const mode=String(formData.get("contentMode") || "internal");
 const slugRaw=String(formData.get("slug")||"").trim().toLowerCase();
 const slug=slugRaw||id||randomUUID();
 if(slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return {error:"記事URLスラッグは半角英数字とハイフンで入力してください。"};
 const seoTitle=String(formData.get("seoTitle")||"").trim(); if(seoTitle.length>160)return {error:"SEOタイトルは160文字以内で入力してください。"};
 const authorName=String(formData.get("authorName")||"").trim(), authorProfile=String(formData.get("authorProfile")||"").trim();
 if(authorName.length>120||authorProfile.length>1000)return {error:"著者名・プロフィールが長すぎます。"};
 const imageRights=String(formData.get("imageRights")||"").trim(); if(imageRights.length>1000)return {error:"画像の権利情報は1000文字以内で入力してください。"};
 let canonicalUrl:string|null=null; const canonicalRaw=String(formData.get("canonicalUrl")||"").trim(); if(canonicalRaw){try{const u=new URL(canonicalRaw);if(!["http:","https:"].includes(u.protocol))throw Error();canonicalUrl=u.href}catch{return {error:"canonical URLを確認してください。"}}}
 const publishedRaw=String(formData.get("publishedAt")||"").trim(); const publishedAt=publishedRaw?new Date(publishedRaw).toISOString():null;
 let references:{label:string;url?:string}[]=[]; try{const x=JSON.parse(String(formData.get("references")||"[]"));if(!Array.isArray(x)||x.length>30)throw Error();references=x.map((r:any)=>({label:String(r.label||"").trim().slice(0,300),url:String(r.url||"").trim().slice(0,2048)})).filter((r:any)=>r.label||r.url);for(const r of references)if(r.url){const u=new URL(r.url);if(!["http:","https:"].includes(u.protocol))throw Error();}}catch{return {error:"参考資料の入力内容を確認してください。"}}
 const relatedArticleIds=[...new Set(formData.getAll("relatedArticleIds").map(String))]; if(relatedArticleIds.length>12||relatedArticleIds.some(x=>!uuid.test(x)))return {error:"関連記事は12件以内で選択してください。"};
 const intent=String(formData.get("intent"));
 const requestedVisibility=String(formData.get("visibility")||"draft");
 if(!["draft","published","private"].includes(requestedVisibility))return {error:"公開状態を選択してください。"};
 const visibility=requestedVisibility==="private"?"private":intent==="publish"?"published":"draft";
 const active=visibility==="published";
 if(!["draft","publish"].includes(intent)) return {error:"保存方法を選択してください。"};
 if(!title || title.length>160 || summary.length>600) return {error:"タイトルは160文字以内、紹介文は600文字以内で入力してください。"};
 if(!BLOG_CATEGORIES.some(c=>c===category) || !["internal","external"].includes(mode)) return {error:"カテゴリと記事形式を選択してください。"};
 let articleUrl:string|null=null;
 if(mode === "external") {try {const url=new URL(String(formData.get("articleUrl") || "").trim());if(!["https:","http:"].includes(url.protocol)||url.username||url.password||url.href.length>2048)throw Error();articleUrl=url.href;}catch{return {error:"記事URLは https:// または http:// で入力してください。"};}}
 let input:BlogBlock[];
 try {const raw=String(formData.get("body") || "[]");if(raw.length>150000)throw Error();const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>100)throw Error();input=parsed;for(const b of input){if(!b||typeof b!=="object"||!["paragraph","heading","heading3","image","list","table"].includes(b.type))throw Error();if(["paragraph","heading","heading3"].includes(b.type)&&(typeof b.text!=="string"||b.text.length>((b.type==="heading"||b.type==="heading3")?200:20000)))throw Error();if(b.type==="list"&&(!Array.isArray(b.items)||b.items.length>200))throw Error();if(b.type==="table"&&(!Array.isArray(b.rows)||b.rows.length>100))throw Error();if(b.alt!==undefined&&(typeof b.alt!=="string"||b.alt.length>300))throw Error();if(b.caption!==undefined&&(typeof b.caption!=="string"||b.caption.length>300))throw Error();if(b.uploadKey!==undefined&&(typeof b.uploadKey!=="string"||!/^[a-zA-Z0-9_-]{1,80}$/.test(b.uploadKey)))throw Error();}}catch{return {error:"本文の形式を確認してください。本文は100ブロック、合計約10万文字以内です。"};}
 const storeIds=[...new Set(formData.getAll("storeIds").map(String))];
 if(storeIds.length>20 || storeIds.some(s=>!uuid.test(s))) return {error:"関連店舗は20店舗以内で選択してください。"};
 if(storeIds.length){const {data,error}=await supabase.from("stores").select("id").in("id",storeIds);if(error||data?.length!==storeIds.length)return {error:"関連店舗が見つかりません。選択し直してください。"};}
 let previous:{image_url:string;image_path:string;body:BlogBlock[]}|null=null;
 if(id){const {data,error}=await supabase.from("blog_entries").select("image_url,image_path,body").eq("id",id).single();if(error||!data)return {error:"記事が見つかりません。再読み込みしてください。"};previous=data;}
 const files=Array.from(formData.values()).filter((v):v is File=>v instanceof File&&v.size>0);
 if(files.reduce((n,f)=>n+f.size,0)>3*1024*1024)return {error:"1回の添付画像は合計3MB以内にしてください。写真を分けて保存できます。"};
 const uploaded:string[]=[];
 async function upload(file:File){
  if(file.size>3*1024*1024)throw Error("画像は1枚3MB以内で添付してください。");
  const bytes=Buffer.from(await file.arrayBuffer());
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
  const mime=png?"image/png":jpg?"image/jpeg":webp?"image/webp":"";
  if(!mime||mime!==file.type)throw Error("JPEG・PNG・WebP形式の画像を添付してください。");
  const path=`${randomUUID()}.${png?"png":jpg?"jpg":"webp"}`;
  const {error}=await supabase.storage.from("blog-images").upload(path,bytes,{contentType:mime,upsert:false});
  if(error)throw Error("画像を保存できませんでした。もう一度お試しください。");
  uploaded.push(path);return {path,url:supabase.storage.from("blog-images").getPublicUrl(path).data.publicUrl};
 }
 let imageUrl=previous?.image_url || "", imagePath=previous?.image_path || "";
 const body:BlogBlock[]=[];
 let committed = false;
 try {
  const file=formData.get("image");if(file instanceof File&&file.size>0){const image=await upload(file);imageUrl=image.url;imagePath=image.path;}
  if(!imageUrl)throw Error("メイン画像を添付してください。");
  const previousPhotos=new Map((Array.isArray(previous?.body)?previous.body:[]).filter(b=>b.type==="image"&&b.path).map(b=>[b.path,b]));
  for(let i=0;i<input.length;i++){
   const b=input[i];
   if(b.type!=="image"){body.push({type:b.type,text:b.text || "",items:b.items,ordered:b.ordered,rows:b.rows,uploadKey:b.uploadKey});continue;}
   const newFile=formData.get(`bodyImage_${b.uploadKey || i}`);
   let stored:BlogBlock|undefined;
   if(newFile instanceof File&&newFile.size>0){const image=await upload(newFile);stored={type:"image",url:image.url,path:image.path};}
   else if(typeof b.path==="string")stored=previousPhotos.get(b.path);
   if(stored)body.push({type:"image",url:stored.url,path:stored.path,caption:b.caption || "",alt:b.alt?.trim() || "",uploadKey:b.uploadKey});
   else if(active&&mode==="internal")throw Error("本文の写真を添付するか、空の写真ブロックを削除してください。");
  }
  if(active&&mode==="internal"&&!body.some(b=>b.type==="image"||b.text?.trim()||(b.items?.some(x=>x.trim()))||(b.rows?.some(r=>r.some(x=>x.trim())))))throw Error("公開する記事の本文を入力してください。");
  const values={title,summary,slug:slug||undefined,seo_title:seoTitle,meta_description:metaDescription,canonical_url:canonicalUrl,search_index:formData.get("searchIndex")==="on",author_name:authorName,author_profile:authorProfile,published_at:publishedAt||(active?new Date().toISOString():null),category,article_url:articleUrl,content_mode:mode,body,related_store_ids:storeIds,related_article_ids:relatedArticleIds,show_toc:formData.get("showToc")==="on",show_breadcrumbs:formData.get("showBreadcrumbs")==="on",include_in_sitemap:formData.get("includeInSitemap")==="on",reference_sources:references,image_url:imageUrl,image_path:imagePath,image_alt:imageAlt,image_rights:imageRights,visibility,active,featured:formData.get("featured")==="on",updated_at:new Date().toISOString()};
  const query=id?supabase.from("blog_entries").update(values).eq("id",id):supabase.from("blog_entries").insert(values);
  const {data:saved,error}=await query.select("id").single();
  if(error||!saved)throw Error("記事を保存できませんでした。もう一度お試しください。");
  committed = true;
  const keep=new Set([imagePath,...body.flatMap(b=>b.path?[b.path]:[])]);
  const old=[previous?.image_path,...(Array.isArray(previous?.body)?previous.body:[]).map(b=>b.path)].filter((p):p is string=>!!p&&!keep.has(p));
  if(old.length)await supabase.storage.from("blog-images").remove([...new Set(old)]);
  await logAdminAction(supabase,id?"blog_update":"blog_create","blog",saved.id,{title,active});
  revalidatePath("/admin/blog");revalidatePath("/blog");revalidatePath(`/blog/${saved.id}`);revalidatePath(`/blog/${slug}`);revalidatePath("/");
  return {success:active?"記事を公開して保存しました。":"下書きを保存しました。",id:saved.id,body,imageUrl};
 }catch(e){if(!committed && uploaded.length)await supabase.storage.from("blog-images").remove(uploaded);return {error:e instanceof Error?e.message:"保存できませんでした。"};}
}
