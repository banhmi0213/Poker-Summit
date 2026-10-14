/** No-money, server-owned no-limit Hold'em betting state machine.
 * Amounts are integer virtual chips; this module never handles real currency.
 */
export type BettingPlayer = {
  id: string;
  stack: number;
  committed: number;
  totalCommitted: number;
  folded: boolean;
  allIn: boolean;
  acted: boolean;
};
export type BettingRound = {
  players: BettingPlayer[];
  currentBet: number;
  minRaise: number;
  bigBlind: number;
  toAct: string | null;
  lastAggressor: string | null;
};
export type BettingAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "bet"; amount: number }
  | { type: "raise"; amount: number };
export type SidePot = { amount: number; eligible: string[] };

function integer(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}
function nextToAct(players: readonly BettingPlayer[], afterIndex: number, currentBet: number): string | null {
  for (let n = 1; n <= players.length; n++) {
    const p = players[(afterIndex + n) % players.length];
    if (!p.folded && !p.allIn && (!p.acted || p.committed < currentBet)) return p.id;
  }
  return null;
}
export function createBettingRound(
  entries: readonly { id: string; stack: number; committed?: number; totalCommitted?: number; folded?: boolean; allIn?: boolean }[],
  bigBlind: number,
  firstToAct: string,
): BettingRound {
  if (entries.length < 2 || entries.length > 6 || !integer(bigBlind) || bigBlind === 0)
    throw new Error("Require 2–6 players and positive integer big blind");
  if (new Set(entries.map(p => p.id)).size !== entries.length) throw new Error("Duplicate player");
  const players = entries.map(p => {
    const committed = p.committed ?? 0;
    const totalCommitted = p.totalCommitted ?? committed;
    if (!integer(p.stack) || !integer(committed) || !integer(totalCommitted) || totalCommitted < committed)
      throw new Error("Invalid chip amounts");
    return { id: p.id, stack: p.stack, committed, totalCommitted, folded: p.folded ?? false, allIn: (p.allIn ?? false) || p.stack === 0, acted: false };
  });
  const currentBet = Math.max(...players.map(p => p.committed));
  const actor = players.find(p => p.id === firstToAct);
  if (!actor || actor.folded || actor.allIn) throw new Error("Invalid first actor");
  return { players, currentBet, minRaise: bigBlind, bigBlind, toAct: firstToAct, lastAggressor: null };
}
export function applyBettingAction(round: BettingRound, playerId: string, action: BettingAction): BettingRound {
  if (round.toAct !== playerId) throw new Error("Not player's turn");
  const index = round.players.findIndex(p => p.id === playerId);
  if (index < 0) throw new Error("Unknown player");
  const players = round.players.map(p => ({ ...p }));
  const p = players[index];
  const owed = round.currentBet - p.committed;
  let currentBet = round.currentBet;
  let minRaise = round.minRaise;
  let lastAggressor = round.lastAggressor;
  const contribute = (amount: number) => {
    if (!integer(amount) || amount > p.stack) throw new Error("Invalid contribution");
    p.stack -= amount;
    p.committed += amount;
    p.totalCommitted += amount;
    if (p.stack === 0) p.allIn = true;
  };
  switch (action.type) {
    case "fold": p.folded = true; break;
    case "check":
      if (owed !== 0) throw new Error("Cannot check facing a bet");
      break;
    case "call":
      if (owed === 0) throw new Error("Nothing to call");
      contribute(Math.min(owed, p.stack));
      break;
    case "bet":
    case "raise": {
      if (!integer(action.amount) || action.amount <= round.currentBet)
        throw new Error("New total bet must exceed current bet");
      if (action.type === "bet" && round.currentBet !== 0) throw new Error("Use raise facing a bet");
      if (action.type === "raise" && round.currentBet === 0) throw new Error("Use bet to open");
      const contribution = action.amount - p.committed;
      if (contribution > p.stack) throw new Error("Insufficient stack");
      const raiseSize = action.amount - round.currentBet;
      if (raiseSize < round.minRaise && contribution !== p.stack)
        throw new Error("Below minimum raise unless all-in");
      // A short all-in does not reopen betting for players who have already acted.
      if (p.acted && !p.allIn) throw new Error("Player cannot raise again without reopened action");
      contribute(contribution);
      currentBet = action.amount;
      if (raiseSize >= round.minRaise) {
        minRaise = raiseSize;
        lastAggressor = playerId;
        for (const other of players) if (other.id !== playerId && !other.folded && !other.allIn) other.acted = false;
      }
      break;
    }
  }
  p.acted = true;
  const survivors = players.filter(x => !x.folded);
  const toAct = survivors.length <= 1 ? null : nextToAct(players, index, currentBet);
  return { ...round, players, currentBet, minRaise, lastAggressor, toAct };
}
export function bettingRoundComplete(round: BettingRound): boolean {
  return round.toAct === null;
}
export function potTotal(round: BettingRound): number {
  return round.players.reduce((sum, p) => sum + p.totalCommitted, 0);
}
/** Layer all contributions, including dead chips from folded players, into main and side pots. */
export function calculateSidePots(players: readonly Pick<BettingPlayer, "id" | "totalCommitted" | "folded">[]): SidePot[] {
  if (players.some(p => !integer(p.totalCommitted))) throw new Error("Invalid contribution");
  const levels = [...new Set(players.map(p => p.totalCommitted).filter(v => v > 0))].sort((a, b) => a - b);
  let previous = 0;
  const pots: SidePot[] = [];
  for (const level of levels) {
    const contributors = players.filter(p => p.totalCommitted >= level);
    const amount = (level - previous) * contributors.length;
    const eligible = contributors.filter(p => !p.folded).map(p => p.id);
    if (amount > 0) pots.push({ amount, eligible });
    previous = level;
  }
  return pots;
}
/** Clear street commitments but retain all chips already contributed to the pot. */
export function beginNextBettingStreet(round: BettingRound, firstToAct: string): BettingRound {
  const players = round.players.map(p => ({ ...p, committed: 0, acted: false }));
  const actor = players.find(p => p.id === firstToAct);
  if (!actor || actor.folded || actor.allIn) throw new Error("Invalid first actor");
  return { players, currentBet: 0, minRaise: round.bigBlind, bigBlind: round.bigBlind, toAct: firstToAct, lastAggressor: null };
}
