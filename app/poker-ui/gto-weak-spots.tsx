'use client';
import {useCallback,useEffect,useState} from 'react';
import {SOURCE_TEXT,spotLabel,type GtoRecordSource} from '@/lib/poker/gto-record';
import {LEVEL_TEXT,type TrainerLevel} from '@/lib/poker/gto-trainer';
import {syncHandRecords} from './gto-record-sync';
import styles from './gto-weak-spots.module.css';

/** あかんとこ一覧 (owner 2026/11/1「プレイヤーがプレイした全部から収集」): the member's GTO records from every place they
 * play, grouped by spot, the costliest first. Ring and tournament hands are judged in the background on open. */
type Example={source:GtoRecordSource;hand:string;board:string;action:string;freq:number|null;evLoss:number|null;level:TrainerLevel|null;at:string;ref:string|null};
type Spot={spot:string;n:number;misses:number;close:number;good:number;evLoss:number;evN:number;last:string;examples:Example[]};
type Data={days:number;total:{decisions:number;graded:number;misses:number;evLoss:number;evN:number};bySource:Partial<Record<GtoRecordSource,number>>;spots:Spot[];more?:number};
const FILTERS:{id:string;label:string;sources:GtoRecordSource[]|null}[]=[
 {id:'all',label:'全部',sources:null},{id:'ring',label:'リング',sources:['ring']},{id:'tournament',label:'大会',sources:['tournament']},
 {id:'practice',label:'練習卓',sources:['practice']},{id:'training',label:'GTOと対戦・連打',sources:['trainer','drill']}];
const pct=(a:number,b:number)=>b?`${Math.round(a/b*100)}%`:'-';
const bb=(v:number)=>`${v.toFixed(2)}BB`;
const SUIT:Record<string,string>={c:'♣',d:'♦',h:'♥',s:'♠'};
// The headline of a spot (owner 2026/11/1「見出し」): what the member does too often there, from the latest misses,
// and how much it matters next to the costliest spot (three marks at 60% of the top EV loss or more).
const KIND_WORDS:[RegExp,string][]=[[/^フォールド/,'フォールドしすぎ'],[/^チェック/,'チェックしすぎ'],[/^コール/,'コールしすぎ'],[/オールイン/,'オールインしすぎ'],[/^(レイズ|3ベット|4ベット|5ベット|オープン)/,'レイズしすぎ'],[/^ベット/,'ベットしすぎ'],[/^リンプ/,'リンプしすぎ']];
function headline(s:Spot):string{
 const miss=s.examples.filter(e=>e.level==='mistake'||e.level==='blunder'),pool=miss.length?miss:s.examples,count=new Map<string,number>();
 for(const e of pool){const w=KIND_WORDS.find(([r])=>r.test(e.action))?.[1];if(w)count.set(w,(count.get(w)??0)+1);}
 const top=[...count].sort((a,b)=>b[1]-a[1])[0];
 return top&&top[1]*2>=pool.length?top[0]:s.misses?'GTOから外れた打ち方が多い':'おおむねGTOどおり';
}
function weight(s:Spot,top:Spot|undefined):number{
 const base=top?.evLoss?s.evLoss/top.evLoss:top?.misses?s.misses/top.misses:0;
 return base>=0.6?3:base>=0.3?2:1;
}
const boardText=(b:string)=>b.match(/../g)?.map(c=>(c[0]==='T'?'10':c[0])+SUIT[c[1]]).join(' ')??'';

export function GtoWeakSpots({limit,upsell=false}:{limit?:number;upsell?:boolean}={}){
 const [days,setDays]=useState(90),[filter,setFilter]=useState('all'),[data,setData]=useState<Data|null>(null),[error,setError]=useState('');
 const [sync,setSync]=useState<'running'|'done'|null>(null),[open,setOpen]=useState<string|null>(null);
 const load=useCallback(async()=>{
  const f=FILTERS.find(x=>x.id===filter)!;
  try{const r=await fetch(`/api/poker/gto-records?days=${days}${f.sources?`&sources=${f.sources.join(',')}`:''}`,{cache:'no-store'});
   if(r.status===401){setError('ログインすると、打ったハンドから自分のあかんとこが集まります。');return;}
   if(!r.ok)throw Error();setData(await r.json());setError('');}catch{setError('読み込めませんでした。少しおいて開き直してください。');}
 },[days,filter]);
 useEffect(()=>{void load();},[load]);
 // Ring and tournament hands not judged yet: judge them now, then show the list again.
 useEffect(()=>{let live=true;setSync('running');void syncHandRecords().then(added=>{if(!live)return;setSync('done');if(added>0)void load();}).catch(()=>{if(live)setSync('done');});return()=>{live=false;};},[]);// eslint-disable-line react-hooks/exhaustive-deps

 return <div className={styles.wrap}>
  <p className={styles.lead}>リング・大会・練習卓・GTOと対戦・プリフロップ連打で打った判断を全部GTOと比べて、損が大きかった場面から順に並べます。直したい場面から練習しましょう。</p>
  <div className={styles.filters}>
   <div className={styles.tabs} role="group" aria-label="どこで打ったか">{FILTERS.map(f=><button key={f.id} type="button" aria-pressed={filter===f.id} onClick={()=>setFilter(f.id)}>{f.label}</button>)}</div>
   <label className={styles.days}>期間<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7日</option><option value={30}>30日</option><option value={90}>90日</option><option value={365}>1年</option></select></label>
  </div>
  {sync==='running'&&<p className={styles.note} role="status">リング・大会のハンドを判定しています…</p>}
  {error&&<p className={styles.warn} role="alert">{error}</p>}
  {data&&<>
   <div className={styles.cards}>
    <div><small>判断の数</small><b>{data.total.graded.toLocaleString()}</b><span>{Object.entries(data.bySource).map(([k,v])=>`${SOURCE_TEXT[k as GtoRecordSource]} ${v}`).join('・')||'まだありません'}</span></div>
    <div><small>ミス（×・××）</small><b>{pct(data.total.misses,data.total.graded)}</b><span>{data.total.misses.toLocaleString()}回</span></div>
    <div><small>EV損失の合計</small><b>{bb(data.total.evLoss)}</b><span>{data.total.evN?`1回あたり ${bb(data.total.evLoss/data.total.evN)}`:'計算できた判断がまだありません'}</span></div>
   </div>
   {data.spots.length===0?<p className={styles.note}>この期間の記録はまだありません。GTOと対戦やリングで打つと、ここに集まります。</p>:
   <ol className={styles.list}>{data.spots.slice(0,limit??data.spots.length).map((s,i)=>{const graded=s.misses+s.close+s.good||s.n;return <li key={s.spot} className={styles.item}>
    <button type="button" className={styles.head} aria-expanded={open===s.spot} onClick={()=>setOpen(open===s.spot?null:s.spot)}>
     <span className={styles.rank}>{i+1}</span>
     <span className={styles.title}><b>{headline(s)}<i className={styles.stars} aria-label={`重要度 ${weight(s,data.spots[0])}（3段階）`}>{'★'.repeat(weight(s,data.spots[0]))}<s>{'★'.repeat(3-weight(s,data.spots[0]))}</s></i></b><em className={styles.spot}>{spotLabel(s.spot)}</em><small>{s.n}回・ミス {s.misses}回・惜しい {s.close}回・EV損失 {bb(s.evLoss)}{s.evN?`（1回あたり ${bb(s.evLoss/s.evN)}）`:''}</small></span>
     <span className={styles.meter} aria-label={`GTOどおり ${pct(s.good,graded)}`}><i style={{width:pct(s.good,graded)}}/></span>
    </button>
    {open===s.spot&&<div className={styles.body}>{s.examples.length===0?<p className={styles.note}>この場面の最近の判断はGTOどおりでした。</p>:<ul>{s.examples.map((e,k)=><li key={k}>
     <span className={styles.badge} data-level={e.level??''}>{e.level?LEVEL_TEXT[e.level]:'-'}</span>
     <span><b>{e.hand}</b>{e.board&&<em>{boardText(e.board)}</em>}：{e.action}{e.freq!==null&&`（GTOがこの手で選ぶ割合 ${Math.round(e.freq*100)}%）`}{e.evLoss!==null&&e.evLoss>0&&`・EV損失 ${bb(e.evLoss)}`}</span>
     <small>{SOURCE_TEXT[e.source]}・{new Date(e.at).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'})}{(e.source==='ring'||e.source==='tournament')&&e.ref&&<> ・<a href={`/mypage/poker/hands/${e.ref}`}>ハンドを見る</a></>}</small>
    </li>)}</ul>}</div>}
   </li>;})}</ol>}
   {upsell&&(data.more??0)>0&&<div className={styles.upsell}><p>ほかに{data.more}の場面があります。スタンダードプランで全部見られます。</p><a href="/pricing">プランを見る</a></div>}
   <p className={styles.note}>ミス＝GTOがその手で選ぶ割合が8%未満の打ち方。EV損失は、その場でいちばん得な打ち方と比べたチップの差（プリフロップと、計算が十分に詰められたターン・リバー）。4人以上のポットや計算していない場面は数えていません。</p>
  </>}
 </div>;
}
