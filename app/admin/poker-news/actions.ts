"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "@/lib/revalidate";
import { logAdminAction } from "@/lib/audit";
import { parseNewsInput,parseNewsBatch,type NewsInput } from "@/lib/poker-news-input";
export type NewsState={error?:string;success?:string};
async function adminClient(){const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw Error("運営ログインが必要です。");const {data,error}=await client.rpc("is_admin");if(error||data!==true)throw Error("運営権限がありません。");return client;}
function refresh(){revalidatePath("/");revalidatePath("/poker-news");revalidatePath("/admin/poker-news");}
async function checkBlogs(client:Awaited<ReturnType<typeof adminClient>>,rows:NewsInput[]){const ids=[...new Set(rows.map(x=>x.related_blog_id).filter(Boolean))] as string[];if(!ids.length)return;const {data,error}=await client.from("blog_entries").select("id").in("id",ids);if(error||data?.length!==ids.length)throw Error("関連記事が見つかりません。選択を確認してください。");}
export async function savePokerNews(_state:NewsState,form:FormData):Promise<NewsState>{try{const client=await adminClient();const id=String(form.get("id")||"");if(id&&!/^[0-9a-f-]{36}$/i.test(id))throw Error("ニュースIDが不正です。");const input=parseNewsInput({import_key:form.get("import_key"),title:form.get("title"),summary:form.get("summary"),category:form.get("category"),source_url:form.get("source_url"),source_label:form.get("source_label"),related_blog_id:form.get("related_blog_id"),news_date:form.get("news_date"),active:form.get("active")==="on"});await checkBlogs(client,[input]);const row={...input,updated_at:new Date().toISOString()};const query=id?client.from("poker_news").update(row).eq("id",id):client.from("poker_news").insert(row);const {data,error}=await query.select("id").single();if(error||!data)throw Error(error?.code==="23505"?"同じニュースが登録されています。一覧から編集してください。":"保存できませんでした。");await logAdminAction(client,"poker_news_save","poker_news",data.id);refresh();return {success:input.active?"公開して保存しました。":"下書きを保存しました。"};}catch(e){return {error:e instanceof Error?e.message:"保存できませんでした。"};}}
export async function importPokerNews(_state:NewsState,form:FormData):Promise<NewsState>{try{const client=await adminClient();const rows=parseNewsBatch(String(form.get("json")||""));await checkBlogs(client,rows);const {error}=await client.from("poker_news").upsert(rows.map(x=>({...x,updated_at:new Date().toISOString()})),{onConflict:"import_key"});if(error)throw Error("取り込みに失敗しました。入力内容を確認してください。");await logAdminAction(client,"poker_news_import","poker_news",undefined,{count:rows.length});refresh();return {success:`${rows.length}件を登録・更新しました。公開状態はデータの指定に従います。`};}catch(e){return {error:e instanceof Error?e.message:"取り込みに失敗しました。"};}}

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
