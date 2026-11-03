import { bestOfSeven, compareScores, type Card, type HandScore } from "./engine";
import { calculateSidePots, type BettingPlayer } from "./betting";

/** Seat order is clockwise. BTN/SB/BB rotate each hand. */
export function positions(seats: readonly string[], buttonIndex: number) {
  if (seats.length < 2 || seats.length > 6 || new Set(seats).size !== seats.length) throw new Error("Require 2–6 unique seats");
  if (!Number.isInteger(buttonIndex) || buttonIndex < 0 || buttonIndex >= seats.length) throw new Error("Invalid button index");
  const n = seats.length;
  const sb = (buttonIndex + (n === 2 ? 0 : 1)) % n;
  const bb = (sb + 1) % n;
  return { button: seats[buttonIndex], sb: seats[sb], bb: seats[bb],
    preflopFirst: seats[(bb + 1) % n], postflopFirst: seats[(buttonIndex + 1) % n],
    nextButtonIndex: (buttonIndex + 1) % n };
}

export type BlindPositions = { button:string; sb:string|null; bb:string; preflopFirst:string; postflopFirst:string };
export function postBlindsForPositions(
  entries: readonly {id:string;stack:number;totalCommitted?:number}[],
  pos: Pick<BlindPositions,"sb"|"bb">,
  smallBlind:number,bigBlind:number,
) {
  if (!Number.isSafeInteger(smallBlind)||!Number.isSafeInteger(bigBlind)||smallBlind<=0||bigBlind<smallBlind)throw new Error("Invalid blind sizes");
  const ids=entries.map(p=>p.id);
  if(ids.length<2||ids.length>6||new Set(ids).size!==ids.length||!ids.includes(pos.bb)||(pos.sb!==null&&!ids.includes(pos.sb))||pos.sb===pos.bb)throw new Error("Invalid blind seats");
  const players=entries.map(p=>{
    if(!Number.isSafeInteger(p.stack)||p.stack<0||!Number.isSafeInteger(p.totalCommitted??0)||(p.totalCommitted??0)<0)throw new Error("Invalid stack");
    const amount=p.id===pos.sb?smallBlind:p.id===pos.bb?bigBlind:0,paid=Math.min(p.stack,amount);
    const totalCommitted=(p.totalCommitted??0)+paid;if(!Number.isSafeInteger(totalCommitted))throw new Error("Invalid contribution");
    return {id:p.id,stack:p.stack-paid,committed:paid,totalCommitted,allIn:p.stack===paid};
  });
  return {players,pot:players.reduce((sum,p)=>sum+p.totalCommitted,0)};
}
export function postBlinds(entries: readonly {id:string;stack:number;totalCommitted?:number}[],buttonIndex:number,smallBlind:number,bigBlind:number) {
  const pos=positions(entries.map(p=>p.id),buttonIndex);
  return {positions:pos,...postBlindsForPositions(entries,pos,smallBlind,bigBlind)};
}

export type ShowdownEntry = Pick<BettingPlayer, "id" | "totalCommitted" | "folded" | "sharedAnte"> & { hole: readonly [Card, Card] };
export type ShowdownAward = { pot: number; winners: string[]; each: number; oddChips: string[] };
/** Splits side pots, with odd chips allocated clockwise from the button. */
export function settleShowdown(entries: readonly ShowdownEntry[], board: readonly Card[], clockwiseIds: readonly string[], buttonId: string) {
  if (board.length !== 5) throw new Error("Showdown requires five board cards");
  if (new Set(clockwiseIds).size !== clockwiseIds.length || clockwiseIds.length < entries.length || clockwiseIds.length > 6 ||
      entries.some(p => !clockwiseIds.includes(p.id)) || !clockwiseIds.includes(buttonId)) throw new Error("Invalid seat order");
  const scores = new Map<string, HandScore>();
  for (const p of entries) if (!p.folded) scores.set(p.id, bestOfSeven([...p.hole, ...board]));
  const start = (clockwiseIds.indexOf(buttonId) + 1) % clockwiseIds.length;
  const oddChipOrder = [...clockwiseIds.slice(start), ...clockwiseIds.slice(0, start)];
  const payouts = Object.fromEntries(entries.map(p => [p.id, 0])) as Record<string, number>;
  const awards: ShowdownAward[] = [];
  for (const pot of calculateSidePots(entries)) {
    if (!pot.eligible.length) throw new Error("Pot has no eligible players");
    let best = scores.get(pot.eligible[0])!;
    for (const id of pot.eligible.slice(1)) if (compareScores(scores.get(id)!, best) > 0) best = scores.get(id)!;
    const winners = pot.eligible.filter(id => compareScores(scores.get(id)!, best) === 0);
    const each = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount % winners.length;
    const oddChips: string[] = [];
    for (const id of winners) payouts[id] += each;
    for (const id of oddChipOrder) {
      if (!remainder) break;
      if (winners.includes(id)) { payouts[id]++; oddChips.push(id); remainder--; }
    }
    awards.push({ pot: pot.amount, winners, each, oddChips });
  }
  return { payouts, awards, scores };
}

/** Run it twice (or more): every side pot is split across the runs first (odd chip to the first run),
 * then each run's share goes to the best hand on that run's board, odd chips clockwise from the button. */
export function settleShowdownRuns(entries: readonly ShowdownEntry[], boards: readonly (readonly Card[])[], clockwiseIds: readonly string[], buttonId: string) {
  if (boards.length < 1 || boards.length > 2 || boards.some(b => b.length !== 5)) throw new Error("Each run needs five board cards");
  const used = new Set<string>();
  for (const p of entries) for (const c of p.hole) used.add(c.rank + c.suit);
  for (const b of boards) { const own = new Set(b.map(c => c.rank + c.suit)); if (own.size !== 5 || b.some(c => used.has(c.rank + c.suit))) throw new Error("Run board overlaps hole cards"); }
  const start = (clockwiseIds.indexOf(buttonId) + 1) % clockwiseIds.length;
  const oddChipOrder = [...clockwiseIds.slice(start), ...clockwiseIds.slice(0, start)];
  const payouts = Object.fromEntries(entries.map(p => [p.id, 0])) as Record<string, number>;
  const runWinners = boards.map(() => new Set<string>());
  const scores = boards.map(board => { const m = new Map<string, HandScore>(); for (const p of entries) if (!p.folded) m.set(p.id, bestOfSeven([...p.hole, ...board])); return m; });
  for (const pot of calculateSidePots(entries)) {
    if (!pot.eligible.length) throw new Error("Pot has no eligible players");
    boards.forEach((_, r) => {
      const share = Math.floor(pot.amount / boards.length) + (r < pot.amount % boards.length ? 1 : 0);
      const s = scores[r];
      let best = s.get(pot.eligible[0])!;
      for (const id of pot.eligible.slice(1)) if (compareScores(s.get(id)!, best) > 0) best = s.get(id)!;
      const winners = pot.eligible.filter(id => compareScores(s.get(id)!, best) === 0);
      for (const id of winners) { payouts[id] += Math.floor(share / winners.length); runWinners[r].add(id); }
      let remainder = share % winners.length;
      for (const id of oddChipOrder) { if (!remainder) break; if (winners.includes(id)) { payouts[id]++; remainder--; } }
    });
  }
  return { payouts, runWinners: runWinners.map(w => [...w]) };
}
