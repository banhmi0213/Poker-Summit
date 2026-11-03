import { bestOfSeven, compareScores, scoreFive, type Card, type HandScore } from "./engine";

export type DemoDeal = {
  board: readonly Card[];
  holes: Record<string, readonly [Card, Card]>;
};
const suitMarks = { c: "♣", d: "♦", h: "♥", s: "♠" } as const;
const faceRanks: Readonly<Record<number, string>> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export const rankLabel = (rank: number) => faceRanks[rank] ?? String(rank);
export const cardLabel = (card: Card) => `${rankLabel(card.rank)}${suitMarks[card.suit]}`;
export const isRedCard = (card: Card) => card.suit === "h" || card.suit === "d";

/** The player's current made hand once the flop is out (null before the flop or without cards). */
export function madeHandLabel(hole: readonly Card[] | null | undefined, board: readonly Card[]): string | null {
  if (!hole || hole.length !== 2 || board.length < 3) return null;
  if (board.length >= 5) return handLabel([hole[0], hole[1]], board.slice(0, 5));
  // Flop/turn: best five of the 5 or 6 cards available so far.
  const cards = [...hole, ...board];
  let best: HandScore | null = null;
  const pick = (start: number, chosen: Card[]) => {
    if (chosen.length === 5) { const score = scoreFive(chosen); if (!best || compareScores(score, best) > 0) best = score; return; }
    for (let i = start; i < cards.length; i++) pick(i + 1, [...chosen, cards[i]]);
  };
  pick(0, []);
  return scoreLabel(best!);
}

function scoreLabel(score: HandScore): string {
  if (score[0] === 8 && score[1] === 14) return "ロイヤルフラッシュ";
  const names = ["ハイカード", "ワンペア", "ツーペア", "スリーカード", "ストレート", "フラッシュ", "フルハウス", "フォーカード", "ストレートフラッシュ"];
  return `${names[score[0]]}（${rankLabel(score[1])}）`;
}

/** Use exactly the same seven-card evaluator as chip settlement. */
export function handLabel(hole: readonly [Card, Card], board: readonly Card[]): string {
  return scoreLabel(bestOfSeven([...hole, ...board]));
}
