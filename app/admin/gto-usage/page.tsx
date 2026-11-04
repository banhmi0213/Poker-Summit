import Link from 'next/link';
import {redirect} from 'next/navigation';
import {isUsageAdmin,loadUsage} from '@/lib/gto-usage-server';
import {usagePeriod,jstDay,usageDelta,type UsageSummary} from '@/lib/gto-usage';
import {StatTile} from './stat-tile';
import {UsageTrend} from './trend';
export const dynamic='force-dynamic';
type SP={mode?:string;date?:string;month?:string};
function Delta({value,before,label,available}:{value:number;before:number;label:string;available:boolean}){
 if(!available)return <span className="muted">{label}：集計開始前のため比較なし</span>;
 const d=usageDelta(value,before);
 return <span style={{color:d.change>0?'#15803d':d.change<0?'#dc2626':undefined}}>{label} {d.change>0?'▲':d.change<0?'▼':'±'}{Math.abs(d.change).toLocaleString()}（{d.percent===null?(value?'比較元0・新規':'0%'):`${Math.abs(d.percent).toFixed(1)}%`}）</span>;
}
export default async function GtoUsagePage({searchParams}:{searchParams:SP}){
 // Check here as well as in admin/layout: no service-role data is loaded before authorization.
 if(!await isUsageAdmin())redirect('/admin-login?next=/admin/gto-usage');
 const mode=searchParams.mode==='monthly'?'monthly':'daily',period=usagePeriod(mode,mode==='daily'?searchParams.date:searchParams.month);
 let result:Awaited<ReturnType<typeof loadUsage>>;
 try{result=await loadUsage(period);}catch(e){return <div><h1>GTO利用状況</h1><p className="err" role="alert">{e instanceof Error?e.message:'読み込めませんでした。'}</p><Link href="/admin/gto-usage" className="btn">再読み込み</Link></div>;}
 const {report,startedAt}=result,label=mode==='daily'?'日次':'月次',compare=mode==='daily'?'前日比':'前月比';
 const since=startedAt?jstDay(startedAt):null,sinceLabel=since?`${Number(since.slice(5,7))}/${Number(since.slice(8))}から集計`:'利用記録が入り次第、集計開始日を表示';
 const comparable=!!since&&jstDay(period.previous)>=since;
 const beforeStart=!!since&&period.end<=Date.parse(since+'T00:00:00+09:00');
 const number=(v:number)=>beforeStart?'—':v.toLocaleString();
 const card=(title:string,value:number,before:number)=><StatTile key={title} label={title} value={number(value)} delta={<><span>{label}・{sinceLabel}</span><br/><Delta value={value} before={before} label={compare} available={comparable}/></>}/>;
 const grid={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:14};
 const td={padding:'9px 8px',textAlign:'right' as const,whiteSpace:'nowrap' as const};
 const row=(title:string,s:UsageSummary,b:UsageSummary)=><tr key={title} style={{borderTop:'1px solid var(--border)',fontWeight:title.startsWith('GTO全体')?700:undefined}}><td style={{...td,textAlign:'left'}}>{title}</td>{[s.uu,s.members,s.pv,s.starts,s.answers].map((n,i)=><td key={i} style={td}>{number(n)}</td>)}<td style={td}><Delta value={s.uu} before={b.uu} label="" available={comparable}/></td></tr>;
 return <div>
  <div className="app-topbar" style={{marginBottom:10}}><h1 style={{fontSize:22,margin:0}}>GTO利用状況</h1><span className="muted" style={{fontSize:12.5}}>{label}・{period.value}（日本時間）・{sinceLabel}</span></div>
  <form className="card" style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:14}}>
   <label>集計単位 <select name="mode" defaultValue={mode}><option value="daily">日次</option><option value="monthly">月次</option></select></label>
   <label>日付 <input type="date" name="date" defaultValue={searchParams.date??jstDay()}/></label><label>月 <input type="month" name="month" defaultValue={searchParams.month??jstDay().slice(0,7)}/></label>
   <button className="btn primary" type="submit">表示する</button><Link className="btn" href={`/admin/gto-usage/csv?mode=${mode}&${mode==='daily'?'date':'month'}=${period.value}`}>CSVダウンロード</Link>
  </form>
  <p className="muted" style={{fontSize:12.5,lineHeight:1.8}}>PV＝開いた回数。UU＝操作した閲覧者IDの重複を除いた人数。ログイン人数は会員IDで重複を除外します。全体の人数は道具をまたいだ重複も除きます。運営・スタッフ・ボットは除外。比較は利用人数（カードは各指標）の前日／前月との差です。{beforeStart?' この期間は集計開始前のため、データはありません。':''}{!startedAt?' まだ利用記録がありません。':''}</p>
  <div style={grid}>{card('GTO全体PV',report.total.pv,report.previous.pv)}{card('GTO全体UU',report.total.uu,report.previous.uu)}{card('ログインして使った人数',report.total.members,report.previous.members)}{card('答えた回数',report.total.answers,report.previous.answers)}</div>
  <div style={grid}>{report.tools.flatMap(t=>[card(`${t.label} PV`,t.pv,t.previous.pv),card(`${t.label} UU`,t.uu,t.previous.uu)])}</div>
  <div className="card" style={{overflowX:'auto',marginBottom:14}}><h2 style={{fontSize:16,marginTop:0}}>道具ごとの利用</h2><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr><th style={{...td,textAlign:'left'}}>道具</th>{['使った人数','うちログイン','開いた回数','始めた回数','答えた回数',`${compare}（人数）`].map(h=><th style={td} key={h}>{h}</th>)}</tr></thead><tbody>{report.tools.map(t=>row(t.label,t,t.previous))}{row('GTO全体（人数は重複除外）',report.total,report.previous)}</tbody></table></div>
  <UsageTrend points={report.trend} monthly={mode==='monthly'} startedAt={startedAt}/>
  <div className="card"><h2 style={{fontSize:16,marginTop:0}}>端末の割合（道具ごとの利用人数）</h2><p className="muted" style={{fontSize:12}}>スマホにはタブレットを含みます。同じ閲覧者が両端末区分を使った場合、各区分に1人ずつ数えます。</p>{report.tools.map(t=>{const n=t.mobile+t.pc,m=n?t.mobile/n*100:0;return <div key={t.tool} style={{marginBottom:14}}><div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:12.5}}><strong>{t.label}</strong><span>{n?`スマホ ${t.mobile}人（${m.toFixed(1)}%）／PC ${t.pc}人（${(100-m).toFixed(1)}%）`:'記録なし'}</span></div><div style={{display:'flex',height:10,background:'var(--border)',borderRadius:99,overflow:'hidden',marginTop:5}}>{n>0&&<><div style={{width:`${m}%`,background:'#be8a2e'}}/><div style={{flex:1,background:'#475569'}}/></>}</div></div>;})}</div>
 </div>;
}
