import { bestOfSeven, type Card } from "./engine";

export type DemoDeal = {
  board: readonly Card[];
  holes: Record<string, readonly [Card, Card]>;
};
const suitMarks = { c: "♣", d: "♦", h: "♥", s: "♠" } as const;
const faceRanks: Readonly<Record<number, string>> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
export const rankLabel = (rank: number) => faceRanks[rank] ?? String(rank);
export const cardLabel = (card: Card) => `${rankLabel(card.rank)}${suitMarks[card.suit]}`;
export const isRedCard = (card: Card) => card.suit === "h" || card.suit === "d";

/** Use exactly the same seven-card evaluator as chip settlement. */
export function handLabel(hole: readonly [Card, Card], board: readonly Card[]): string {
  const score = bestOfSeven([...hole, ...board]);
  if (score[0] === 8 && score[1] === 14) return "ロイヤルフラッシュ";
  const names = ["ハイカード", "ワンペア", "ツーペア", "スリーカード", "ストレート", "フラッシュ", "フルハウス", "フォーカード", "ストレートフラッシュ"];
  return `${names[score[0]]}（${rankLabel(score[1])}）`;
}
