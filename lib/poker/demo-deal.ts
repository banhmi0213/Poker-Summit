/** Server-only card generation for the LOCAL demo, not a multiplayer snapshot.
 * The demo client receives all dealt cards. Never reuse this shape for real opponents.
 */
import { startHand, advanceStreet } from "./hand-state";
import { positions } from "./settlement";
import type { DemoDeal } from "./card-display";

export function dealDemoHand(playerIds: readonly string[], buttonIndex: number): DemoDeal {
  const first = playerIds.indexOf(positions(playerIds, buttonIndex).postflopFirst);
  const order = [...playerIds.slice(first), ...playerIds.slice(0, first)];
  let hand = startHand(order);
  for (let street = 0; street < 3; street++) hand = advanceStreet(hand);
  return { board: hand.board, holes: Object.fromEntries(hand.players.map(p => [p.id, p.hole])) };
}
