/** Server-only CSPRNG shuffle. Never import from client components. */
import { randomInt } from "node:crypto";
import type { Card } from "./engine";

export function shuffleDeck(deck: readonly Card[]): Card[] {
  const result = [...deck];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
