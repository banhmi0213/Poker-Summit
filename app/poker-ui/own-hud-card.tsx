import type {HandStatsSummary} from '@/lib/poker/hand-histories';
import {freeHudStats} from '@/lib/poker/player-hud';
import {HudStatsGrid} from './hud-stats-grid';
export function OwnHudCard({stats}:{stats:HandStatsSummary|null}){
 const hud=stats?freeHudStats({hands:stats.hands,vpip:stats.vpip,pfr:stats.pfr,steal:stats.steal,stealOpp:stats.steal_opp,threeBet:stats.three_bet,threeBetOpp:stats.three_bet_opp,cbet:stats.cbet,cbetOpp:stats.cbet_opp}):null;
 return <section aria-label="自分のプレイ成績" style={{padding:16,margin:'16px 0',border:'1px solid #617784',borderRadius:12,background:'#182430',color:'#eaf0f5'}}>
  <h2 style={{fontSize:17,margin:'0 0 12px',color:'#efcd8b'}}>自分のプレイ成績</h2>
  {hud?<><HudStatsGrid stats={hud}/><p style={{fontSize:12,lineHeight:1.6,margin:'8px 0 0',color:'#b7c8d4'}}>リングゲーム全体の集計です。テーブル内では、そのレートの成績を表示します。機会がない項目は「—」です。</p></>:<p>成績を取得できませんでした。時間をおいて再読み込みしてください。</p>}
 </section>;
}
