import {createClient} from '@/lib/supabase/server';
import {parseBetPreferences,defaultBetPreferences} from '@/lib/poker/bet-presets';
export const dynamic='force-dynamic';
const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store, private'}});
export async function GET(){const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return reply(401,{error:'ログインしてください。'});let settings=defaultBetPreferences;try{settings=parseBetPreferences(user.user_metadata?.poker_bet_preferences);}catch{}return reply(200,{settings,accountId:user.id});}
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return reply(403,{error:'送信元を確認できません。'});
 // This trial must never write to the production Auth project.
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://mjdgylgzhsygcgtuceow.supabase.co'))return reply(503,{error:'検証用の会員設定保存先が未接続です。'});
 const client=await createClient();const {data:{user},error}=await client.auth.getUser();if(error||!user)return reply(401,{error:'ログインしてください。'});
 let settings;try{const raw=await request.text();if(raw.length>2048)throw Error();const body=JSON.parse(raw);if(body.accountId!==user.id)return reply(409,{error:'ログイン中の会員が変わりました。画面を再読込してください。'});settings=parseBetPreferences(body.settings);}catch{return reply(400,{error:'BB倍率は1〜20、POTは1〜500%で入力してください。'});}
 const result=await client.auth.updateUser({data:{poker_bet_preferences:settings}});return result.error?reply(503,{error:'保存できませんでした。再度お試しください。'}):reply(200,{settings});
}
