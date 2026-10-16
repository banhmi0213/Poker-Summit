/** Server-only card generation for the LOCAL demo, not a multiplayer snapshot.
 * The demo client receives all dealt cards. Never reuse this shape for real opponents.
 */
import { startHand, advanceStreet } from "./hand-state";
import { positions } from "./settlement";
import type { DemoDeal } from "./card-display";

export function dealDemoHand(playerIds: readonly string[], buttonIndex: number): DemoDeal {
  const first = playerIds.indexOf(positions(playerIds, buttonIndex).postflopFirst);
  const order = [...playerIds.slice(first), ...playerIds.slice(0, first)];
  return dealInOrder(order);
}
function dealInOrder(order:readonly string[]):DemoDeal {
  let hand = startHand(order);
  for (let street = 0; street < 3; street++) hand = advanceStreet(hand);
  return { board: hand.board, holes: Object.fromEntries(hand.players.map(p => [p.id, p.hole])) };
}

/** Deal only to surviving seats, beginning clockwise after the physical button. */
export function dealDemoHandAtTable(order:readonly string[],live:readonly string[],button:string):DemoDeal {
  if(order.length<2||order.length>6||new Set(order).size!==order.length||!order.includes(button)||live.length<2||live.length>6||new Set(live).size!==live.length||live.some(id=>!order.includes(id))||(live.length===2&&!live.includes(button)))throw new Error("Invalid demo seats");
  const start=(order.indexOf(button)+1)%order.length;
  return dealInOrder([...order.slice(start),...order.slice(0,start)].filter(id=>live.includes(id)));
}
