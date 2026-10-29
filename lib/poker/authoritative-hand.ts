/** Server-owned single-hand coordinator. Transport must supply the authenticated seat ID.
 * Not a network endpoint/store: replicas require a shared transaction/CAS before use.
 * Never accept a HandTerms/stack/deck/viewer ID from an untrusted action payload.
 */
import { randomInt, randomUUID } from "node:crypto";
import { applyBettingAction, beginNextBettingStreet, legalBettingActions, potTotal, type BettingAction, type BettingRound } from "./betting";
import { dealDemoHandAtTable } from "./demo-deal";
import { settleCompletedHand } from "./hand-settlement";
import { settleShowdownRuns } from "./settlement";
import { startForcedHand, type HandTerms } from "./tournament-hand";
import type { BlindPositions } from "./settlement";
import { bestOfSeven, compareScores, type Card } from "./engine";
import { finishTournamentHand, type Elimination } from "./tournament-table";

import {parseHandCommand as parseCommand,type Command} from './hand-command';
type Result=NonNullable<ReturnType<typeof settleCompletedHand>>&{boards?:Card[][];runWinners?:string[][];/** Chips taken for the house; already left out of payouts. */rake?:number;rakePaid?:Record<string,number>};
/** Deal plus, for ring hands, 5 spare cards used as the second run's board (run it twice). */
type Deal=ReturnType<typeof dealDemoHandAtTable>&{alt?:Card[]};
/** Run-it-twice decision for an all-in runout: every live player answers 1 or 2; any 1 (or a timeout) means once. */
type RunsState={from:0|3|4;participants:string[];choices:Record<string,1|2>;decided:1|2|null};
const cardKey=(c:Card)=>c.rank+c.suit;
function spareCards(deal:ReturnType<typeof dealDemoHandAtTable>):Card[]{
  const used=new Set([...deal.board,...Object.values(deal.holes).flat()].map(cardKey)),deck:Card[]=[];
  for(const suit of ['c','d','h','s'] as const)for(let rank=2;rank<=14;rank++){const c={rank,suit} as Card;if(!used.has(cardKey(c)))deck.push(c);}
  for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  return deck.slice(0,5);
}
const copyCards=(cards:readonly Card[])=>cards.map(c=>({...c}));

const restoreToken=Symbol("trusted hand restore");
const validRake=(r:unknown):r is RakeRule=>{const v=r as RakeRule;return Boolean(v)&&Number.isInteger(v.bps)&&v.bps>=0&&v.bps<=1000&&Number.isInteger(v.capBb)&&v.capBb>=0&&v.capBb<=100;};
/** Ring rake (owner 2026/10/29): basis points of the contested pot (300 = 3%), capped at capBb big blinds. */
export type RakeRule={bps:number;capBb:number};
type Initial={entries:{id:string;stack:number}[];buttonIndex:number;terms:HandTerms;table?:{order:string[];positions:BlindPositions};rake?:RakeRule};
export type HandCheckpoint={version:1;id:string;initial:Initial;deal:Deal;commands:{actor:string;command:Command}[]};
export class AuthoritativeHand {
  #initial:Initial; #commands:{actor:string;command:Command}[]=[];
  #id:string=randomUUID(); #revision=0; #round:BettingRound; #street=0;
  #order:string[]; #positions:BlindPositions; #terms:HandTerms;
  #deal:Deal; #result:Result|null=null; #runs:RunsState|null=null;
  #starting:Record<string,number>;
  #receipts=new Map<string,{fingerprint:string;revision:number}>();
  /** options.runItTwice (ring only) deals spare cards so an all-in runout can be run twice. */
  constructor(entries:readonly {id:string;stack:number}[],buttonIndex:number,terms:HandTerms,table?:{order:readonly string[];positions:BlindPositions},restore?:{token:symbol;id:string;deal:Deal},options?:{runItTwice?:boolean;rake?:RakeRule}) {
    if(entries.some(p=>typeof p.id!=="string"||(!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)||Object.hasOwn(Object.prototype,p.id)||p.id==="prototype")))throw new Error("Invalid seat ID");
    const order=table?[...table.order]:entries.map(p=>p.id);
    if(table&&JSON.stringify(order.filter(id=>entries.some(p=>p.id===id)))!==JSON.stringify(entries.map(p=>p.id)))throw new Error("Entries must follow physical seat order");
    if(options?.rake&&!validRake(options.rake))throw new Error("Invalid rake rule");
    this.#initial=structuredClone({entries:[...entries],buttonIndex,terms,table:table?{order:[...table.order],positions:table.positions}:undefined,...(options?.rake?{rake:{bps:options.rake.bps,capBb:options.rake.capBb}}:{})});
    this.#starting=Object.fromEntries(entries.map(p=>[p.id,p.stack]));
    const forced=startForcedHand(entries,buttonIndex,terms,table?{...table.positions}:undefined);
    this.#round=forced.round;this.#order=order;this.#positions={...forced.positions};this.#terms={...forced.terms};
    if(restore&&restore.token!==restoreToken)throw new Error("Invalid restore capability");
    if(restore)this.#deal=structuredClone(restore.deal);
    else{const deal=dealDemoHandAtTable(this.#order,entries.map(p=>p.id),this.#positions.button);this.#deal=options?.runItTwice?{...deal,alt:spareCards(deal)}:deal;}
    if(restore)this.#id=restore.id;
    this.#progress();
  }
  /** Sensitive server-only state. Encrypt before storage; never send over transport. */
  checkpoint():HandCheckpoint {return structuredClone({version:1,id:this.#id,initial:this.#initial,deal:this.#deal,commands:this.#commands});}
  /** Replays accepted commands against the SAME private deal, rebuilding receipts/accounting. */
  static restore(saved:HandCheckpoint) {
    if(saved?.version!==1||typeof saved.id!=="string"||!Array.isArray(saved.commands)||saved.commands.length>4096)throw new Error("Invalid hand checkpoint");
    const i=saved.initial,deal=saved.deal;
    if(!i||!Array.isArray(i.entries)||!deal||!Array.isArray(deal.board)||deal.board.length!==5||!deal.holes)throw new Error("Invalid saved deal");
    if(deal.alt!==undefined&&(!Array.isArray(deal.alt)||deal.alt.length!==5))throw new Error("Invalid saved spare cards");
    const cards=[...deal.board,...(deal.alt??[]),...i.entries.flatMap(p=>{const h=deal.holes[p.id];if(!Array.isArray(h)||h.length!==2)throw new Error("Invalid saved hole");return h;})];
    if(cards.some(c=>!c||!Number.isInteger(c.rank)||c.rank<2||c.rank>14||!['c','d','h','s'].includes(c.suit))||new Set(cards.map(c=>c.rank+c.suit)).size!==cards.length)throw new Error("Invalid saved cards");
    if(i.rake!==undefined&&!validRake(i.rake))throw new Error("Invalid saved rake");
    const hand=new AuthoritativeHand(i.entries,i.buttonIndex,i.terms,i.table,{token:restoreToken,id:saved.id,deal},i.rake?{rake:i.rake}:undefined);
    for(const entry of saved.commands) {const r=hand.act(entry.actor,entry.command);if(r.replayed)throw new Error("Duplicate saved command");}
    return hand;
  }
  /** Rabbit hunt: the board cards that were never dealt because the hand ended early (no showdown). */
  /** A finished hand's hole cards of one seat (for 「見せる」 after the hand). */
  finishedHole(seatId:string):Card[]|null{const r=this.#result;if(!r)return null;const h=this.#deal.holes[seatId];return Array.isArray(h)&&h.length===2?copyCards(h):null;}
  rabbitBoard():Card[]|null{
    const r=this.#result as {showdown?:boolean}|null;
    if(!r||r.showdown)return null;const shown=this.#boardCount();
    return shown>=5?null:structuredClone(this.#deal.board.slice(shown,5));
  }
  #boardCount(){return this.#street===0?0:this.#street===1?3:this.#street===2?4:5;}
  #progress() {
    while(this.#round.toAct===null&&!this.#result) {
      const live=this.#round.players.filter(p=>!p.folded);
      // All-in runout before the river: on ring tables, stop and let the players choose one or two runs.
      if(this.#deal.alt&&this.#street<3&&live.length>=2&&live.filter(p=>!p.allIn).length<=1){
        if(!this.#runs)this.#runs={from:this.#boardCount() as 0|3|4,participants:this.#order.filter(id=>live.some(p=>p.id===id)),choices:{},decided:null};
        if(this.#runs.decided===null)return;
        if(this.#runs.decided===2){
          const first=this.#deal.board,from=this.#runs.from,second=[...first.slice(0,from),...this.#deal.alt.slice(0,5-from)];
          const split=settleShowdownRuns(this.#round.players.map(p=>({...p,hole:this.#deal.holes[p.id]})),[first,second],this.#order,this.#positions.button);
          this.#result=this.#raked({showdown:true,payouts:split.payouts,winners:[...new Set(split.runWinners.flat())],boards:[copyCards(first),copyCards(second)],runWinners:split.runWinners});
          this.#street=4;return;
        }
      }
      const result=settleCompletedHand(this.#round,this.#deal.board,this.#deal.holes,this.#order,this.#positions.button,this.#street===3);
      if(result){this.#result=this.#raked(result);if(result.showdown)this.#street=4;return;}
      this.#street++;
      const start=this.#order.indexOf(this.#positions.postflopFirst);
      const first=[...this.#order.slice(start),...this.#order.slice(0,start)].find(id=>this.#round.players.some(p=>p.id===id&&!p.folded&&!p.allIn));
      if(!first)throw new Error("No postflop actor");
      this.#round=beginNextBettingStreet(this.#round,first);
    }
  }
  /** Who turns their cards face up at a finished showdown (null before one). All-in: every live hand.
   * Otherwise: a chop shows only the players who chop; one winner shows with the second-best hand (ties for second all show). */
  /** Ring rake: no flop, no drop. Otherwise bps of the contested pot (an uncalled bet is not part of it), at most capBb
   * big blinds, taken out of the winnings in proportion to what each player won (largest remainders get the odd chips). */
  #raked(r:Result):Result{
    const rule=this.#initial.rake;if(!rule)return r;
    if(!r.showdown&&this.#street===0)return r;
    const totals=this.#round.players.map(p=>p.totalCommitted).sort((a,b)=>b-a),uncalled=totals.length>1&&totals[0]>totals[1]?totals[0]-totals[1]:0;
    const contested=totals.reduce((a,b)=>a+b,0)-uncalled,topId=uncalled?this.#round.players.find(p=>p.totalCommitted===totals[0])!.id:null;
    const rake=Math.min(Math.floor(contested*rule.bps/10000),rule.capBb*this.#terms.bb);if(rake<=0)return r;
    const won=Object.fromEntries(Object.entries(r.payouts).map(([id,v])=>[id,Math.max(0,v-(id===topId?uncalled:0))]));
    const pool=Object.values(won).reduce((a,b)=>a+b,0);if(pool<rake)return r;
    const share=Object.entries(won).map(([id,v])=>({id,exact:rake*v/pool})).map(x=>({...x,base:Math.floor(x.exact)}));
    let left=rake-share.reduce((a,x)=>a+x.base,0);
    for(const x of [...share].sort((a,b)=>(b.exact-b.base)-(a.exact-a.base)||(won[b.id]-won[a.id]))){if(!left)break;if(x.base<won[x.id]){x.base++;left--;}}
    const rakePaid:Record<string,number>={},payouts={...r.payouts};
    for(const x of share)if(x.base>0){rakePaid[x.id]=x.base;payouts[x.id]-=x.base;}
    return {...r,payouts,rake,rakePaid};
  }
  #shownCache:{result:object;shown:Set<string>}|null=null;
  #shownAtShowdown():Set<string>|null{
    const r=this.#result;if(!r?.showdown)return null;
    if(this.#shownCache?.result===r)return this.#shownCache.shown;
    const shown=this.#computeShown(r);this.#shownCache={result:r,shown};return shown;
  }
  #computeShown(r:Result):Set<string>{
    const live=this.#round.players.filter(p=>!p.folded);
    if(this.#runs||r.boards||live.some(p=>p.allIn))return new Set(live.map(p=>p.id));
    if(r.winners.length>=2)return new Set(r.winners);
    const board=this.#deal.board,rest=live.filter(p=>!r.winners.includes(p.id)).map(p=>({id:p.id,score:bestOfSeven([...this.#deal.holes[p.id],...board])}));
    if(!rest.length)return new Set(r.winners);
    const top=rest.reduce((a,b)=>compareScores(b.score,a.score)>0?b:a);
    return new Set([...r.winners,...rest.filter(x=>compareScores(x.score,top.score)===0).map(x=>x.id)]);
  }
  /** Only this allow-listed projection may cross the transport boundary.
   * null = spectator; member IDs must be resolved from auth + server seating.
   * Returning fresh objects prevents consumers from mutating internal state.
   */
  snapshot(viewerId:string|null) {
    if(viewerId!==null&&!this.#round.players.some(p=>p.id===viewerId))throw new Error("Unknown viewer seat");
    const count=this.#street===0?0:this.#street===1?3:this.#street===2?4:5,shown=this.#shownAtShowdown();
    return {
      handId:this.#id,revision:this.#revision,street:["preflop","flop","turn","river","showdown"][this.#street],
      board:copyCards(this.#deal.board.slice(0,count)),positions:{...this.#positions},terms:{...this.#terms},
      pot:this.#result?0:potTotal(this.#round),toAct:this.#round.toAct,
      players:this.#round.players.map(p=>({id:p.id,stack:p.stack+(this.#result?.payouts[p.id]??0),committed:p.committed,totalCommitted:p.totalCommitted,folded:p.folded,allIn:p.allIn,
        // All-in hands are turned face up as soon as the runout is reached. At a showdown without an all-in only the
        // winner and the second-best hand are shown, or only the players who chop; the rest muck (owner 2026/10/29).
        hole:p.id===viewerId||(!p.folded&&(shown?shown.has(p.id):Boolean(this.#runs)))?copyCards(this.#deal.holes[p.id]):null})),
      legal:viewerId?legalBettingActions(this.#round,viewerId):null,
      result:this.#result?{showdown:this.#result.showdown,payouts:{...this.#result.payouts},winners:[...this.#result.winners],...(this.#result.rake?{rake:this.#result.rake,rakePaid:{...this.#result.rakePaid}}:{}),
        ...(this.#result.boards?{boards:this.#result.boards.map(copyCards),runWinners:this.#result.runWinners!.map(w=>[...w])}:{})}:null,
      ...(this.#runs?{runs:{from:this.#runs.from,participants:[...this.#runs.participants],
        choices:Object.fromEntries(this.#runs.participants.map(id=>[id,this.#runs!.choices[id]??null])) as Record<string,1|2|null>,decided:this.#runs.decided,
        canChoose:Boolean(viewerId&&this.#runs.decided===null&&this.#runs.participants.includes(viewerId)&&!this.#runs.choices[viewerId])}}:{}),
    };
  }
  /** Server-only terminal accounting; preserves ante-aware elimination ordering. */
  finishTournament(prior:readonly Elimination[]=[]) {
    if(!this.#result)throw new Error("Hand is not settled");
    return finishTournamentHand(this.#round,this.#starting,this.#result.payouts,this.#terms.anteType,prior);
  }
  /** Read-only receipt lookup lets a room acknowledge retries even after a deadline. */
  replay(authenticatedSeatId:string,input:unknown) {
    if(!this.#round.players.some(p=>p.id===authenticatedSeatId))throw new Error("Unknown actor seat");
    const c=parseCommand(input);
    if(c.handId!==this.#id)throw new Error("Wrong hand");
    const receipt=this.#receipts.get(authenticatedSeatId+":"+c.actionId);
    if(!receipt)return null;
    if(receipt.fingerprint!==JSON.stringify(c))throw new Error("Action ID reused with different payload");
    return {replayed:true,acceptedRevision:receipt.revision,state:this.snapshot(authenticatedSeatId)};
  }
  /** Synchronous within this owner: no awaits between version check and commit.
   * A retry returns the latest personalized snapshot, but never reapplies a wager.
   * A changed payload with the same per-seat actionId is rejected.
   */
  act(authenticatedSeatId:string,input:unknown) {
    if(!this.#round.players.some(p=>p.id===authenticatedSeatId))throw new Error("Unknown actor seat");
    const c=parseCommand(input);
    if(c.handId!==this.#id)throw new Error("Wrong hand");
    const key=authenticatedSeatId+":"+c.actionId,fingerprint=JSON.stringify(c),receipt=this.#receipts.get(key);
    if(receipt) {
      if(receipt.fingerprint!==fingerprint)throw new Error("Action ID reused with different payload");
      return {replayed:true,acceptedRevision:receipt.revision,state:this.snapshot(authenticatedSeatId)};
    }
    if(c.revision!==this.#revision)throw new Error("Stale revision");
    if(this.#result)throw new Error("Hand already settled");
    if(this.#receipts.size>=4096)throw new Error("Action limit reached");
    // Roll back progression failures too; rejected commands must never partially apply.
    const prior={round:this.#round,street:this.#street,result:this.#result,runs:structuredClone(this.#runs)};
    try {
      const a=c.action;
      if(a.type==="runs"){
        const runs=this.#runs;
        if(!runs||runs.decided!==null)throw new Error("No run choice pending");
        if(!runs.participants.includes(authenticatedSeatId)||runs.choices[authenticatedSeatId])throw new Error("Not your run choice");
        runs.choices[authenticatedSeatId]=a.count;
        if(a.count===1)runs.decided=1;
        else if(runs.participants.every(id=>runs.choices[id]===2))runs.decided=2;
        this.#progress();
      }else{
        if(this.#runs&&this.#runs.decided===null)throw new Error("Waiting for run choice");
        this.#round=applyBettingAction(this.#round,authenticatedSeatId,a);this.#progress();
      }
    }
    catch(error){this.#round=prior.round;this.#street=prior.street;this.#result=prior.result;this.#runs=prior.runs;throw error;}
    this.#revision++;this.#receipts.set(key,{fingerprint,revision:this.#revision});this.#commands.push({actor:authenticatedSeatId,command:structuredClone(c)});
    return {replayed:false,acceptedRevision:this.#revision,state:this.snapshot(authenticatedSeatId)};
  }
}

/** Shared strict grammar for the player request boundary; derives no actor identity. */
export {parseHandCommand} from './hand-command';
