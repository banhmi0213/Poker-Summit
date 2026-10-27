import {loadBotStats,BOT_POSITIONS,HAND_CLASSES,type BotPositionRow} from '@/lib/poker/bot-stats';
export const dynamic='force-dynamic';
const rate=(n:number,d:number)=>d>0?`${Math.round(n*1000/d)/10}%`:'—';
const per100=(net:number,hands:number)=>hands>0?`${net/hands*100>=0?'+':''}${(Math.round(net/hands*1000)/10).toLocaleString()}`:'—';
function sum(rows:BotPositionRow[],label:string):BotPositionRow{
 const keys=['hands','vpip','pfr','three_bet_opp','three_bet','fold_to_3bet_opp','fold_to_3bet','cbet_opp','cbet','fold_to_cbet_opp','fold_to_cbet','saw_flop','wtsd','wsd','net_bb'] as const;
 const out={position:label,style:label} as BotPositionRow;for(const k of keys)out[k]=rows.reduce((s,r)=>s+r[k],0);return out;
}
function StatsTable({rows,first}:{rows:BotPositionRow[];first:string}){
 return <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>{first}</th><th>ハンド数</th><th>100ハンドあたり</th><th>VPIP</th><th>PFR</th><th>3ベット</th><th>3ベットにフォールド</th><th>Cベット</th><th>Cベットにフォールド</th><th>フロップを見た</th><th>WTSD</th><th>W$SD</th></tr></thead>
  <tbody>{rows.map(r=><tr key={r.position+r.style}><td>{first==='ポジション'?r.position:r.style}</td><td>{r.hands.toLocaleString()}</td><td>{per100(r.net_bb,r.hands)}BB</td><td>{rate(r.vpip,r.hands)}</td><td>{rate(r.pfr,r.hands)}</td><td>{rate(r.three_bet,r.three_bet_opp)}</td><td>{rate(r.fold_to_3bet,r.fold_to_3bet_opp)}</td><td>{rate(r.cbet,r.cbet_opp)}</td><td>{rate(r.fold_to_cbet,r.fold_to_cbet_opp)}</td><td>{rate(r.saw_flop,r.hands)}</td><td>{rate(r.wtsd,r.saw_flop)}</td><td>{rate(r.wsd,r.wtsd)}</td></tr>)}</tbody></table></div>;
}
export default async function Page(){
 const data=await loadBotStats();
 if(!data)return <main className="container"><h1>CPU卓の集計</h1><p>運営権限、またはテスト環境の設定をご確認ください。データを取得できませんでした。</p></main>;
 const byPos=BOT_POSITIONS.map(p=>sum(data.positions.filter(r=>r.position===p),p));
 const styles=[...new Set(data.positions.map(r=>r.style))];
 const byStyle=styles.map(s=>sum(data.positions.filter(r=>r.style===s),s));
 const total=sum(data.positions,'合計');const hands=Math.round(total.hands/6);
 const cell=new Map(data.classes.map(c=>[c.position+'|'+c.class,c]));
 return <main className="container"><h1>CPU卓の集計（テスト環境）</h1>
  <p>CPU 6人がサーバーと同じ進行で回し続けたハンドの集計です。データ集めと不具合・負荷の確認用で、実際のプレイヤーの成績ではありません。</p>
  <p>集計ハンド数 <strong>{hands.toLocaleString()}</strong>（保存中の履歴 {data.stored.toLocaleString()}）・{data.settings?.enabled?`稼働中（${data.settings.tables}卓）`:'停止中'}・直近1時間 {data.speed.hands.toLocaleString()}ハンド・1ハンド平均 {data.speed.avgMs??'—'}ms（最大 {data.speed.maxMs??'—'}ms）・メモリ {data.speed.rssMb??'—'}MB</p>
  {(()=>{const d=data.decisions,main=['preflop','flop','solver','fallback'],total=main.reduce((s,k)=>s+(d[k]??0),0);const label:Record<string,string>={preflop:'プリフロップ表',flop:'フロップの事前計算',solver:'ターン・リバーのその場計算',fallback:'補助（GTOの対象外）','fallback:multiway':'3人以上のポット','fallback:flop-class-missing':'フロップ計算にない手','fallback:preflop-off-chart':'プリフロップ表にない流れ','fallback:stack-depth':'スタックが浅い・深い','fallback:solver-off-tree':'ターン・リバーの想定外の額','fallback:flop-off-tree':'フロップの想定外の額','fallback:no-flop-data':'フロップ計算が未完成'};
   return total>0&&<><h2>CPUの判断の内訳</h2><p>{main.map(k=>`${label[k]} ${rate(d[k]??0,total)}`).join('・')}</p><p style={{fontSize:13}}>補助の理由：{Object.entries(d).filter(([k])=>k.startsWith('fallback:')).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`${label[k]??k.slice(9)} ${n.toLocaleString()}`).join('・')||'なし'}</p></>;})()}
  <p>検査で見つかった異常 <strong>{data.anomalies.toLocaleString()}件</strong></p>
  {data.recentAnomalies.length>0&&<ul>{data.recentAnomalies.map((a,i)=><li key={i}>{new Date(a.at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})} {a.kind}：{a.detail}</li>)}</ul>}
  <h2>ポジション別</h2><StatsTable rows={[...byPos,total]} first="ポジション"/>
  <h2>CPUのタイプ別</h2><StatsTable rows={byStyle} first="タイプ"/>
  <h2>スターティングハンド × ポジション（1ハンドあたりの損益BB・回数）</h2>
  <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>ハンド</th>{BOT_POSITIONS.map(p=><th key={p}>{p}</th>)}<th>合計</th></tr></thead>
   <tbody>{HAND_CLASSES.map(c=>{const rows=BOT_POSITIONS.map(p=>cell.get(p+'|'+c));const n=rows.reduce((s,r)=>s+(r?.hands??0),0),net=rows.reduce((s,r)=>s+(r?.net_bb??0),0);
    return <tr key={c}><td>{c}</td>{rows.map((r,i)=><td key={i}>{r&&r.hands>0?`${r.net_bb/r.hands>=0?'+':''}${(r.net_bb/r.hands).toFixed(2)}（${r.hands}）`:'—'}</td>)}<td>{n>0?`${net/n>=0?'+':''}${(net/n).toFixed(2)}（${n}）`:'—'}</td></tr>;})}</tbody></table></div>
 </main>;
}
