import Link from 'next/link';
import {notFound} from 'next/navigation';
import {staticPageMetadata} from '@/lib/seo';
import {POSITION_NAME,POSITION_SLUGS,RANKS,actionTotals,chartAssumptions,handLabel,positionNode,type PositionSlug} from '@/lib/poker/preflop-positions';
import {strategyColor} from '@/app/poker-ui/strategy-colors';
import {StrategyLegend} from '@/app/poker-ui/strategy-legend';
import chart from '@/app/poker-ui/gto-chart.module.css';
import styles from '../../gto-tool-page.module.css';
import {GtoToolPage} from '../../gto-tool-page';
import {POSITION_TEXT} from '../position-text';

// ポジション別のプリフロップ解説 (owner 2026/10/31): one page per position, its chart in full; the other charts,
// the range trainer and GTOと対戦 stay for members. noindex until the search side switches it on.
export const dynamicParams=false;
export function generateStaticParams(){return POSITION_SLUGS.map(pos=>({pos}));}
const isSlug=(s:string):s is PositionSlug=>(POSITION_SLUGS as readonly string[]).includes(s);

export function generateMetadata({params}:{params:{pos:string}}){
 if(!isSlug(params.pos))return {};
 const t=POSITION_TEXT[params.pos];
 return staticPageMetadata({title:t.metaTitle,description:t.description,path:`/learn/preflop/${params.pos}`,index:false});
}

const pct=(v:number)=>`${Math.round(v*100)}%`;

export default function Page({params}:{params:{pos:string}}){
 const slug=isSlug(params.pos)?params.pos:null,node=slug?positionNode(slug):null;
 if(!slug||!node)return notFound();
 const t=POSITION_TEXT[slug];
 const totals=actionTotals(node),info=chartAssumptions();
 const tool=<div className={chart.wrap}>
  <p className={styles.chartHead}><b>{t.chartTitle}</b><br/>全体では {node.actions.map((a,i)=>`${a.label} ${pct(totals[i]??0)}`).join('・')}</p>
  <StrategyLegend actions={node.actions}/>
  <table className={chart.grid} aria-label={`${POSITION_NAME[slug]}の手札ごとの打ち方`}><tbody>{[...RANKS].map((_,i)=><tr key={i}>{[...RANKS].map((_,j)=>{
   const l=handLabel(i,j),e=node.strategy[l];
   if(!e)return <td key={j} data-on="none">{l}</td>;
   let acc=0;const stops=node.actions.map((a,ai)=>{const from=acc;acc+=e[ai]*100;return `${strategyColor(a,node.actions)} ${from}% ${acc}%`;}).join(',');
   return <td key={j} data-on="mix" style={{background:`linear-gradient(90deg,${stops})`}} title={`${l}：${node.actions.map((a,ai)=>`${a.label} ${pct(e[ai])}`).join('・')}`}>{l}</td>;
  })}</tr>)}</tbody></table>
  <p className={styles.chartNote}>マスにカーソルを合わせる（スマートフォンは長押し）と、その手の割合が出ます。表は計算を続けて、随時更新しています。</p>
 </div>;
 return <GtoToolPage title={t.title} lead={t.lead} tool={tool}
  join={{text:'オープンされたとき・3ベットされたときなど、ほかの場面の表や、レンジの練習・GTOと対戦は会員登録（無料）で使えます。',label:'会員登録してほかの表も見る'}}>
  <nav className={styles.posNav} aria-label="ポジション別の表">{POSITION_SLUGS.map(s=>s===slug?<b key={s} aria-current="page">{POSITION_NAME[s]}</b>:<Link key={s} href={`/learn/preflop/${s}`}>{POSITION_NAME[s]}</Link>)}</nav>
  {t.body(i=>pct(totals[i]??0))}
  <h2>表の見方</h2>
  <ul>
   <li>縦横13×13のマスが、169通りの手札です。左上から右下の斜めがポケットペア、その右上が同じマーク（s＝スーテッド）、左下が違うマーク（o＝オフスート）です。</li>
   <li>マスの色の割合が、その手でそれぞれの打ち方を選ぶ割合です。1つの手で打ち方を混ぜるのは、相手に読まれないためで、GTOではよくあることです。</li>
  </ul>
  <h2>計算の前提</h2>
  <ul>{info.assumptions.map((a,i)=><li key={i}>{a}</li>)}</ul>
  <p><small>{info.iterations.toLocaleString()}回計算。6人分を厳密に解くのは計算が重すぎるため、上の前提で簡略化しています。</small></p>
  <h2>ほかのポジション</h2>
  <ul>{POSITION_SLUGS.filter(s=>s!==slug).map(s=><li key={s}><Link href={`/learn/preflop/${s}`}>{POSITION_TEXT[s].title}</Link></li>)}</ul>
 </GtoToolPage>;
}
