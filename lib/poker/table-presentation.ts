/** Display-only seat rotation. Never deals, evaluates hands or changes chip totals. */
import type {PlayerSnapshot} from './player-client';
export const tableSlots=['you','p5','p3','p2','p4','p6'] as const;
export function onlineTableSeats(state:PlayerSnapshot,includeEmpty=false,fixedSeats=false){
 const occupied=includeEmpty?state.seats:state.seats.filter(s=>s.occupied),anchor=state.youSeat??(occupied.length===2?(occupied[0]?.seat??1):1);
 return occupied.map(seat=>{
  const offset=(seat.seat-anchor+6)%6;
  // Heads-up occupies opposite ends; seat identities/BTN/blinds remain server-owned.
  const slot=fixedSeats?tableSlots[(seat.seat-1)%6]:occupied.length===2?(seat.seat===anchor?'you':'p2'):tableSlots[offset];
  const player=state.hand?.players.find(p=>p.id===seat.id);
  return {seat,slot,player,isYou:state.youSeat===seat.seat,
   stack:player?.stack??state.tournament?.stacks[seat.id]??null,
   positions:state.hand?(['button','sb','bb'] as const).filter(p=>state.hand!.positions[p]===seat.id).map(p=>p==='button'?'BTN':p.toUpperCase()).join(' / '):'',
   committed:state.hand?.result?0:player?.committed??0,
   payout:state.hand?.result?.payouts[seat.id]??0,delta:state.hand?.result?(state.hand.result.payouts[seat.id]??0)-(player?.totalCommitted??0):null};
 });
}
export function onlineTurnSeconds(state:PlayerSnapshot){return state.turn?Math.max(0,Math.ceil((state.turn.expiresAt-state.serverNow)/1000)):null;}
