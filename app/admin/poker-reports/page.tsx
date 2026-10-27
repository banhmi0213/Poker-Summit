import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
type Row={memberId:string;name:string;reports:number;open:number;reporters:number;last:string;reasons:Record<string,number>|null;notes:{reason:string;note:string;at:string}[];ban:{until:string|null;reason:string}|null};
const REASON:Record<string,string>={abuse:'暴言・嫌がらせ',name:'不適切な名前・アイコン',griefing:'わざと進行を妨げる',cheating:'不正の疑い',other:'その他'};
const jst=(s:string)=>new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
async function ban(form:FormData){'use server';
 const member=String(form.get('member')??''),days=String(form.get('days')??''),reason=String(form.get('reason')??'').slice(0,500);
 if(!/^[0-9a-f-]{36}$/i.test(member))return;
 const client=await createClient();await client.rpc('poker_admin_ban',{p_member:member,p_days:days==='lift'?null:Number(days),p_reason:reason});
 revalidatePath('/admin/poker-reports');
}
/** 通報の確認とポーカーの利用停止（運営のみ。権限は RPC 側でも確認）。 */
export default async function Page(){
 const client=await createClient(),{data,error}=await client.rpc('poker_admin_reports');
 if(error||!Array.isArray(data))return <main className="container"><h1>ポーカーの通報</h1><p>運営権限をご確認ください。データを取得できませんでした。</p></main>;
 const rows=data as Row[];
 return <main className="container"><h1>ポーカーの通報</h1>
  <p>会員からの通報をプレイヤーごとにまとめています。利用停止にすると、リング卓に新しく着席できなくなります（サイトの他の機能はそのまま使えます）。</p>
  {!rows.length&&<p>通報はまだありません。</p>}
  {rows.map(r=><section key={r.memberId} style={{border:'1px solid #ddd',borderRadius:8,padding:12,margin:'12px 0'}}>
   <h2 style={{fontSize:16,margin:'0 0 6px'}}>{r.name}{r.ban&&<small style={{color:'#b42318',marginLeft:8}}>利用停止中（{r.ban.until?`${jst(r.ban.until)}まで`:'解除するまで'}）</small>}</h2>
   <p style={{fontSize:13,margin:'0 0 6px'}}>通報 {r.reports}件（未対応 {r.open}件・通報した人 {r.reporters}人）・最新 {jst(r.last)}・{Object.entries(r.reasons??{}).map(([k,n])=>`${REASON[k]??k} ${n}`).join('・')}</p>
   <ul style={{fontSize:13,margin:'0 0 8px'}}>{r.notes.map((n,i)=><li key={i}>{jst(n.at)}［{REASON[n.reason]??n.reason}］{n.note||'（内容なし）'}</li>)}</ul>
   <form action={ban} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
    <input type="hidden" name="member" value={r.memberId}/>
    <select name="days" defaultValue="7" aria-label="利用停止の期間"><option value="1">1日</option><option value="7">7日</option><option value="30">30日</option><option value="0">解除するまで</option>{r.ban&&<option value="lift">利用停止を解除</option>}</select>
    <input name="reason" placeholder="理由（運営のメモ）" maxLength={500} style={{flex:'1 1 200px'}}/>
    <button type="submit" className="btn">実行</button>
   </form>
  </section>)}
 </main>;
}
