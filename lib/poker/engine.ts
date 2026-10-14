/** Pure, server-authoritative Texas Hold'em primitives.
 * No network, persistence or wagering. Use a cryptographic random source in production.
 */
import { randomInt } from "node:crypto";

export type Suit = "c" | "d" | "h" | "s";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type Card = Readonly<{ rank: Rank; suit: Suit }>;
export type HandScore = readonly [number, ...number[]];

const suits: Suit[] = ["c", "d", "h", "s"];
export function createDeck(): Card[] {
  return suits.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ suit, rank: (i + 2) as Rank })));
}

export function shuffleDeck(deck: readonly Card[]): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Returns lexicographically comparable scores: 8 straight flush to 0 high card. */
export function scoreFive(cards: readonly Card[]): HandScore {
  if (cards.length !== 5) throw new Error("Exactly five cards required");
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const unique = [...new Set(ranks)];
  const straightRanks = unique.includes(14) ? [...unique, 1] : unique;
  let straightHigh = 0;
  for (let i = 0; i <= straightRanks.length - 5; i++) {
    if (straightRanks[i] - straightRanks[i + 4] === 4) { straightHigh = straightRanks[i]; break; }
  }
  const flush = cards.every(c => c.suit === cards[0].suit);
  if (flush && straightHigh) return [8, straightHigh];
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map(g => g[0]).sort((a,b) => b-a)];
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = groups.slice(0, 2).map(g => g[0]).sort((a,b) => b-a);
    return [2, ...pairs, groups[2][0]];
  }
  if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map(g => g[0]).sort((a,b) => b-a)];
  return [0, ...ranks];
}

export function compareScores(a: HandScore, b: HandScore): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function bestOfSeven(cards: readonly Card[]): HandScore {
  if (cards.length !== 7) throw new Error("Exactly seven cards required");
  let best: HandScore | null = null;
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++)
          for (let e = d + 1; e < 7; e++) {
            const score = scoreFive([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareScores(score, best) > 0) best = score;
          }
  return best!;
}
