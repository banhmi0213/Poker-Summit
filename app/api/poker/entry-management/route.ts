import {tournamentActor} from '@/lib/poker/tournament-admin';
import {readPokerJSON} from '@/lib/poker/player-request-handler';
import {pokerUUID} from '@/lib/poker/request-auth';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const respond=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private'}});
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')return respond(403,{error:'送信元を確認してください。'});
  const body=await readPokerJSON(request);
  if(!body||!['admin','store'].includes(body.scope)||typeof body.tournamentId!=='string'||!pokerUUID.test(body.tournamentId)||!['load','save'].includes(body.type)||Object.keys(body).sort().join(',')!==(body.type==='load'?'scope,tournamentId,type':'emails,scope,tournamentId,type'))return respond(400,{error:'設定を確認してください。'});
  if(body.type==='save'&&(!Array.isArray(body.emails)||body.emails.length<2||body.emails.length>6||body.emails.some((e:unknown)=>typeof e!=='string'||e.length>254||!/^\S+@\S+\.\S+$/.test(e))))return respond(400,{error:'確認済み会員のメールアドレスを2〜6件入力してください。'});
  const {client}=await tournamentActor(body.scope);
  const {data,error}=await client.rpc('poker_entry_manage',{p_tournament:body.tournamentId,...(body.type==='save'?{p_emails:body.emails}:{})});
  if(error)return respond(400,{error:'権限、確認済みメール、重複、開始10分前の締切を確認してください。登録済みの対象者は削除できません。'});
  return respond(200,{ok:true,result:data});
 }catch{return respond(403,{error:'管理権限またはログイン状態を確認してください。'});}
}
