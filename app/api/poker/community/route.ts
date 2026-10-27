import {createClient} from '@/lib/supabase/server';
import {communityMessage,communityPostId} from '@/lib/poker/community-request';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
const response=(status:number,data:unknown)=>Response.json(data,{status,headers});
const fields='id,title,body,author_name,created_at';
async function context(){const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return null;const suspended=await client.rpc('is_suspended');if(suspended.error||suspended.data!==false)return null;return {client,user};}
export async function GET(request:Request){
 const ctx=await context();if(!ctx)return response(401,{error:'ログイン状態を確認してください。'});
 let postId:string|null;try{postId=communityPostId(new URL(request.url).searchParams.get('post'));}catch{return response(400,{error:'投稿を確認できません。'});}
 if(!postId){const {data,error}=await ctx.client.from('board_posts').select(fields).eq('status','visible').order('created_at',{ascending:false}).limit(30);return error?response(503,{error:'掲示板を取得できません。'}):response(200,{posts:data??[]});}
 const {data:post,error}=await ctx.client.from('board_posts').select(fields).eq('id',postId).eq('status','visible').maybeSingle();if(error)return response(503,{error:'掲示板を取得できません。'});if(!post)return response(404,{error:'この投稿は表示できません。'});
 const replies=await ctx.client.from('board_replies').select('id,body,author_name,created_at').eq('post_id',postId).eq('status','visible').order('created_at',{ascending:false}).limit(50);
 return replies.error?response(503,{error:'返信を取得できません。'}):response(200,{post,replies:(replies.data??[]).reverse()});
}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return response(403,{error:'送信元を確認できません。'});
 const ctx=await context();if(!ctx)return response(401,{error:'ログイン状態を確認してください。'});
 let message:ReturnType<typeof communityMessage>;try{if(Number(request.headers.get('content-length'))>4096)throw Error();const text=await request.text();if(new TextEncoder().encode(text).length>4096)throw Error();message=communityMessage(JSON.parse(text));}catch{return response(400,{error:'タイトル100文字・本文1000文字以内で入力してください。'});}
 if(message.type==='reply'){const parent=await ctx.client.from('board_posts').select('id').eq('id',message.postId).eq('status','visible').maybeSingle();if(parent.error||!parent.data)return response(404,{error:'返信先を表示できません。'});}
 const table=message.type==='post'?'board_posts':'board_replies';
 // A stable message ID permits explicit retry after a lost acknowledgement.
 const existing=await ctx.client.from(table).select('id,author_user_id,body,'+(message.type==='post'?'title':'post_id')).eq('id',message.id).maybeSingle();
 if(existing.error)return response(503,{error:'送信結果を確認できません。'});
 if(existing.data){const previous=existing.data as unknown as Record<string,unknown>;const own=previous.author_user_id===ctx.user.id&&previous.body===message.body&&(message.type==='post'?previous.title===message.title:previous.post_id===message.postId);return own?response(200,{ok:true,id:message.id}):response(409,{error:'送信内容を確認してください。'});}
 const row={id:message.id,author_user_id:ctx.user.id,author_name:String(ctx.user.user_metadata?.display_name||'会員').slice(0,80),body:message.body};
 const saved=message.type==='post'?await ctx.client.from('board_posts').insert({...row,title:message.title,category:'雑談'}):await ctx.client.from('board_replies').insert({...row,post_id:message.postId});
 return saved.error?response(503,{error:'送信結果を確認できません。同じ内容で再確認してください。'}):response(200,{ok:true,id:message.id});
}
