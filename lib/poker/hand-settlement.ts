import type { Card } from "./engine";
import { potTotal, type BettingRound } from "./betting";
import { settleShowdown } from "./settlement";

/** Resolve a completed round when the hand ends; null means another street is needed.
 * Pure calculation: callers replace the payout snapshot, never add it repeatedly.
 */
export function settleCompletedHand(
  round: BettingRound,
  board: readonly Card[],
  holes: Readonly<Record<string, readonly [Card, Card]>>,
  clockwiseIds: readonly string[],
  buttonId: string,
  riverComplete: boolean,
): { showdown: boolean; payouts: Record<string, number>; winners: string[] } | null {
  if (round.toAct !== null) throw new Error("Betting round is not complete");
  const live = round.players.filter(p => !p.folded);
  if (!live.length) throw new Error("Hand has no live players");
  if (live.length === 1) {
    return {
      showdown: false,
      payouts: Object.fromEntries(round.players.map(p => [p.id, p.id === live[0].id ? potTotal(round) : 0])),
      winners: [live[0].id],
    };
  }
  // One player with chips cannot make a further wager against all-in opponents.
  if (!riverComplete && live.filter(p => !p.allIn).length > 1) return null;
  const result = settleShowdown(round.players.map(p => {
    if (!holes[p.id]) throw new Error("Missing hole cards");
    return { ...p, hole: holes[p.id] };
  }), board, clockwiseIds, buttonId);
  return { showdown: true, payouts: result.payouts, winners: [...new Set(result.awards.flatMap(a => a.winners))] };
}
