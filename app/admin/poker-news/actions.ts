"use server";
import { randomUUID } from "node:crypto";
import { getNewsLinkPreview,validatePreviewImageUrl } from "@/lib/news-link-preview";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "@/lib/revalidate";
import { logAdminAction } from "@/lib/audit";
import { parseNewsInput,parseNewsBatch,type NewsInput } from "@/lib/poker-news-input";
export type NewsState={error?:string;success?:string;imageUrl?:string;imageSourceUrl?:string};
async function adminClient(){const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw Error("運営ログインが必要です。");const {data,error}=await client.rpc("is_admin");if(error||data!==true)throw Error("運営権限がありません。");return client;}
function refresh(){revalidatePath("/");revalidatePath("/poker-news");revalidatePath("/admin/poker-news");}
async function checkBlogs(client:Awaited<ReturnType<typeof adminClient>>,rows:NewsInput[]){const ids=[...new Set(rows.map(x=>x.related_blog_id).filter(Boolean))] as string[];if(!ids.length)return;const {data,error}=await client.from("blog_entries").select("id").in("id",ids);if(error||data?.length!==ids.length)throw Error("関連記事が見つかりません。選択を確認してください。");}
type StoredNews=Record<string,any>;
async function thumbnailValues(input:NewsInput,previous?:StoredNews,force=false){
 const mode=input.thumbnail_mode||previous?.thumbnail_mode||"auto";
 const common={thumbnail_mode:mode,thumbnail_alt:input.thumbnail_alt??previous?.thumbnail_alt??"",thumbnail_rights:input.thumbnail_rights??previous?.thumbnail_rights??"",thumbnail_source_url:input.thumbnail_source_url??previous?.thumbnail_source_url??""};
 if(mode==="none")return {...common,thumbnail_url:previous?.thumbnail_url||"",thumbnail_path:previous?.thumbnail_path||"",thumbnail_error:""};
 if(mode==="manual"){const url=input.thumbnail_url??previous?.thumbnail_url??"";if(url)await validatePreviewImageUrl(url);return {...common,thumbnail_url:url,thumbnail_path:url===previous?.thumbnail_url?previous?.thumbnail_path||"":"",thumbnail_error:"",thumbnail_checked_at:new Date().toISOString()};}
 if(!force&&previous?.source_url===input.source_url&&previous?.thumbnail_mode==="auto"&&previous?.thumbnail_url)return {...common,thumbnail_url:previous.thumbnail_url,thumbnail_path:"",thumbnail_error:previous.thumbnail_error||"",thumbnail_checked_at:previous.thumbnail_checked_at};
 const preview=await getNewsLinkPreview(input.source_url);
 return {...common,thumbnail_url:preview.imageUrl,thumbnail_path:"",thumbnail_source_url:preview.sourceUrl,thumbnail_checked_at:new Date().toISOString(),thumbnail_error:preview.error};
}
export async function previewPokerNewsImage(sourceUrl:string){try{await adminClient();if(typeof sourceUrl!=="string"||sourceUrl.length>2048)throw Error();return await getNewsLinkPreview(sourceUrl);}catch{return {imageUrl:"",sourceUrl:"",error:"画像を取得できませんでした。URLと運営ログインをご確認ください。"};}}
export async function savePokerNews(_state:NewsState,form:FormData):Promise<NewsState>{
 let uploadedPath="";let committed=false;let client:Awaited<ReturnType<typeof adminClient>>|undefined;
 try{
  client=await adminClient();const id=String(form.get("id")||"");if(id&&!/^[0-9a-f-]{36}$/i.test(id))throw Error("ニュースIDが不正です。");
  const input=parseNewsInput({import_key:form.get("import_key"),title:form.get("title"),summary:form.get("summary"),category:form.get("category"),source_url:form.get("source_url"),source_label:form.get("source_label"),related_blog_id:form.get("related_blog_id"),news_date:form.get("news_date"),active:form.get("active")==="on",thumbnail_mode:form.get("thumbnail_mode")||"auto",thumbnail_url:form.get("thumbnail_url")||"",thumbnail_alt:form.get("thumbnail_alt")||"",thumbnail_rights:form.get("thumbnail_rights")||"",thumbnail_source_url:form.get("thumbnail_source_url")||""});
  await checkBlogs(client,[input]);let previous:StoredNews|undefined;
  if(id){const {data,error}=await client.from("poker_news").select("*").eq("id",id).single();if(error||!data)throw Error("ニュースが見つかりません。");previous=data;}
  const file=form.get("thumbnail_file");
  let thumbnail;
  if(file instanceof File&&file.size>0){
   if(input.thumbnail_mode!=="manual")throw Error("アップロード画像を使う場合は手動画像を選択してください。");
   if(file.size>3*1024*1024)throw Error("画像は3MB以内で登録してください。");
   const bytes=Buffer.from(await file.arrayBuffer());
   const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const webp=bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
   const mime=png?"image/png":jpg?"image/jpeg":webp?"image/webp":"";
   if(!mime||mime!==file.type)throw Error("JPEG・PNG・WebPの画像を登録してください。");
   uploadedPath=`news/${randomUUID()}.${png?"png":jpg?"jpg":"webp"}`;
   const {error}=await client.storage.from("blog-images").upload(uploadedPath,bytes,{contentType:mime,upsert:false});if(error){uploadedPath="";throw Error("画像をアップロードできませんでした。");}
   thumbnail={thumbnail_mode:"manual",thumbnail_url:client.storage.from("blog-images").getPublicUrl(uploadedPath).data.publicUrl,thumbnail_path:uploadedPath,thumbnail_alt:input.thumbnail_alt||"",thumbnail_rights:input.thumbnail_rights||"",thumbnail_source_url:input.thumbnail_source_url||input.source_url,thumbnail_checked_at:new Date().toISOString(),thumbnail_error:""};
  } else thumbnail=await thumbnailValues(input,previous,form.get("thumbnail_refresh")==="on");
  const row={...input,...thumbnail,updated_at:new Date().toISOString()};const query=id?client.from("poker_news").update(row).eq("id",id):client.from("poker_news").insert(row);const {data,error}=await query.select("id").single();if(error||!data)throw Error(error?.code==="23505"?"同じニュースが登録されています。一覧から編集してください。":"保存できませんでした。");
  committed=true;await logAdminAction(client,"poker_news_save","poker_news",data.id);refresh();
  if(previous?.thumbnail_path?.startsWith("news/")&&previous.thumbnail_path!==thumbnail.thumbnail_path)await client.storage.from("blog-images").remove([previous.thumbnail_path]);
  return {imageUrl:thumbnail.thumbnail_url,imageSourceUrl:thumbnail.thumbnail_source_url,success:(input.active?"公開して保存しました。":"下書きを保存しました。")+(thumbnail.thumbnail_error?" 紹介画像は取得できませんでした。ニュースは画像なしで表示します。":"")};
 }catch(e){if(client&&uploadedPath&&!committed)await client.storage.from("blog-images").remove([uploadedPath]).catch(()=>{});return {error:e instanceof Error?e.message:"保存できませんでした。"};}
}
export async function importPokerNews(_state:NewsState,form:FormData):Promise<NewsState>{try{
 const client=await adminClient();const rows=parseNewsBatch(String(form.get("json")||""));await checkBlogs(client,rows);
 const {data:previous,error:readError}=await client.from("poker_news").select("*").in("import_key",rows.map(x=>x.import_key));if(readError)throw Error("登録済みニュースを確認できませんでした。");
 const old=new Map((previous||[]).map(x=>[x.import_key,x]));const resolved:Record<string,unknown>[]=new Array(rows.length);let next=0;
 async function worker(){for(;;){const i=next++;if(i>=rows.length)return;resolved[i]={...rows[i],...await thumbnailValues(rows[i],old.get(rows[i].import_key)),updated_at:new Date().toISOString()};}}
 await Promise.all(Array.from({length:Math.min(4,rows.length)},()=>worker()));
 const {error}=await client.from("poker_news").upsert(resolved,{onConflict:"import_key"});if(error)throw Error("取り込みに失敗しました。入力内容を確認してください。");await logAdminAction(client,"poker_news_import","poker_news",undefined,{count:rows.length});refresh();const failed=resolved.filter(x=>x.thumbnail_error).length;return {success:`${rows.length}件を登録・更新しました。`+(failed?` ${failed}件は画像を取得できなかったため画像なしで表示します。`:"")};
 }catch(e){return {error:e instanceof Error?e.message:"取り込みに失敗しました。"};}}

export async function deletePokerNews(_state:NewsState,form:FormData):Promise<NewsState>{
 try {
  const client=await adminClient();
  const id=String(form.get("id")||"");
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)||form.get("confirmation")!=="delete")throw Error("削除対象を確認してください。");
  const {data,error}=await client.from("poker_news").delete().eq("id",id).select("id").maybeSingle();
  if(error)throw Error("削除できませんでした。もう一度お試しください。");
  if(!data)throw Error("ニュースが見つかりません。再読み込みしてください。");
  await logAdminAction(client,"poker_news_delete","poker_news",id);
  refresh();
 } catch(e){return {error:e instanceof Error?e.message:"削除できませんでした。"};}
 redirect("/admin/poker-news");
}
