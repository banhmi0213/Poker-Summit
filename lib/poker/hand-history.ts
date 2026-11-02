/** Server-only hand history builder (2026/10/26).
 * Input is the decrypted hand checkpoint, so the output contains EVERY player's hole cards.
 * Store it only in poker_private and expose it through the filtering read RPCs:
 * members see their own cards and cards shown at showdown; only operators see folded cards.
 */
import {AuthoritativeHand,type HandCheckpoint} from './authoritative-hand';
import type {Card} from './engine';
import {handStats,type HandStats} from './hand-stats';

export type HistoryStreet='preflop'|'flop'|'turn'|'river';
export type HistoryAction={street:HistoryStreet;seatId:string;type:'ante'|'sb'|'bb'|'fold'|'check'|'call'|'bet'|'raise';amount:number;to:number;allIn:boolean;pot:number};
export type HistoryPlayer={seatId:string;seat:number;memberId:string;position:string;startStack:number;endStack:number;net:number;hole:Card[];folded:boolean;shown:boolean;stats:HandStats};
export type HandHistory={version:1;handId:string;/** Ring hands: the table's rake (2026/10/31); absent on older records. */rake?:{bps:number;capBb:number};terms:{sb:number;bb:number;ante:number;anteType:string;level:number};buttonSeatId:string;players:HistoryPlayer[];board:Card[];actions:HistoryAction[];result:{showdown:boolean;winners:string[];payouts:Record<string,number>;
 /** Ring all-in run twice: each run's board and winners (the first run's board is also `board`). */
 runs?:{board:Card[];winners:string[]}[]}};

const streets:HistoryStreet[]=['preflop','flop','turn','river'];
const cards=(list:readonly Card[])=>list.map(c=>({rank:c.rank,suit:c.suit}));
const seatNumber=(seatId:string)=>{const m=/^seat-([1-6])$/.exec(seatId);if(!m)throw new Error('Invalid history seat');return Number(m[1]);};

/** BTN/SB/BB, then UTG→CO for the remaining live seats (2〜6 players). */
function positionLabels(order:readonly string[],live:readonly string[],pos:{button:string;sb:string|null;bb:string}){
 const start=(order.indexOf(pos.button)+1)%order.length;
 const clockwise=[...order.slice(start),...order.slice(0,start)].filter(id=>live.includes(id));
 const labels:Record<string,string>={};
 const rest=clockwise.filter(id=>id!==pos.button&&id!==pos.sb&&id!==pos.bb);
 const names=[[],['UTG'],['UTG','CO'],['UTG','HJ','CO']][rest.length];
 if(!names)throw new Error('Invalid history roster');
 rest.forEach((id,i)=>{labels[id]=names[i];});
 for(const id of live){if(id===pos.button)labels[id]='BTN';else if(id===pos.sb)labels[id]='SB';else if(id===pos.bb)labels[id]='BB';}
 return labels;
}

/** members maps engine seat IDs (seat-1〜seat-6) to authenticated member IDs. Settled hands only. */
export function buildHandHistory(checkpoint:HandCheckpoint,members:Readonly<Record<string,string>>):HandHistory{
 const replay=(count:number)=>AuthoritativeHand.restore({...checkpoint,commands:checkpoint.commands.slice(0,count)}).snapshot(null);
 const first=replay(0),final=replay(checkpoint.commands.length);
 if(!final.result)throw new Error('Hand is not settled');
 const entries=checkpoint.initial.entries,live=entries.map(p=>p.id);
 if(live.some(id=>typeof members[id]!=='string'))throw new Error('Missing history member');
 const order=checkpoint.initial.table?.order??live;
 const labels=positionLabels(order,live,first.positions);
 const actions:HistoryAction[]=[];
 // Forced bets: ante is everything committed before the deal that is not part of the street call.
 for(const p of first.players){const ante=p.totalCommitted-p.committed;if(ante>0)actions.push({street:'preflop',seatId:p.id,type:'ante',amount:ante,to:0,allIn:false,pot:0});}
 for(const kind of ['sb','bb'] as const){const id=first.positions[kind];const p=id?first.players.find(v=>v.id===id):null;if(p&&p.committed>0)actions.push({street:'preflop',seatId:p.id,type:kind,amount:p.committed,to:p.committed,allIn:p.allIn,pot:0});}
 let pot=first.players.reduce((sum,p)=>sum+p.totalCommitted,0);
 for(const a of actions){a.pot=pot;}
 let before=first;
 checkpoint.commands.forEach((entry,i)=>{
  const after=replay(i+1);
  // A run-it-twice answer moves no chips and is not a betting action.
  if(entry.command.action.type==='runs'){before=after;return;}
  const was=before.players.find(p=>p.id===entry.actor)!,now=after.players.find(p=>p.id===entry.actor)!;
  const amount=now.totalCommitted-was.totalCommitted;pot+=amount;
  const street=streets[streets.indexOf(before.street as HistoryStreet)]??'river';
  // Street commitments reset when the street advances; was.committed+amount is the player's street total.
  actions.push({street,seatId:entry.actor,type:entry.command.action.type as HistoryAction['type'],amount,to:was.committed+amount,allIn:now.allIn&&!was.allIn,pot});
  before=after;
 });
 const base=entries.map(e=>{const p=final.players.find(v=>v.id===e.id)!;return {seatId:e.id,seat:seatNumber(e.id),memberId:members[e.id],position:labels[e.id],startStack:e.stack,endStack:p.stack,net:p.stack-e.stack,hole:cards(checkpoint.deal.holes[e.id]),folded:p.folded,shown:p.hole!==null};});
 const board=cards(final.board),runs=final.result.boards?.map((b,i)=>({board:cards(b),winners:[...(final.result!.runWinners?.[i]??[])]}));
 const result={showdown:final.result.showdown,winners:[...final.result.winners],payouts:{...final.result.payouts},...(runs?{runs}:{})};
 const stats=handStats({actions,players:base,board,result});
 const players=base.map(p=>({...p,stats:stats[p.seatId]}));
 const rake=checkpoint.initial.rake;
 return {version:1,handId:final.handId,terms:{sb:final.terms.sb,bb:final.terms.bb,ante:final.terms.ante,anteType:final.terms.anteType,level:final.terms.level},buttonSeatId:first.positions.button,players,board,actions,result,...(rake?{rake:{bps:rake.bps,capBb:rake.capBb}}:{})};
}
