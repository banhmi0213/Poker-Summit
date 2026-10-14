/** Deterministic hand lifecycle. Only the server should own this state in multiplayer. */
import type { Card } from "./engine";
import { createDeck } from "./engine";
import { shuffleDeck } from "./server-shuffle";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
export type PlayerStatus = "active" | "folded" | "all-in";
export type HandPlayer = { id: string; hole: readonly [Card, Card]; status: PlayerStatus };
export type HandState = {
  street: Street;
  deck: readonly Card[];
  deckIndex: number;
  board: readonly Card[];
  players: readonly HandPlayer[];
  burns: readonly Card[];
};

export function startHand(playerIds: readonly string[]): HandState {
  if (playerIds.length < 2 || playerIds.length > 6 || new Set(playerIds).size !== playerIds.length)
    throw new Error("Texas Hold'em requires 2–6 unique players");
  const deck = shuffleDeck(createDeck());
  const players: HandPlayer[] = playerIds.map((id, index) => ({
    id, hole: [deck[index], deck[index + playerIds.length]], status: "active",
  }));
  return { street: "preflop", deck, deckIndex: playerIds.length * 2, board: [], burns: [], players };
}

/** Advance only after the betting round is complete (validated by caller). */
export function advanceStreet(state: HandState): HandState {
  if (state.street === "showdown") throw new Error("Hand has already reached showdown");
  const live = state.players.filter(p => p.status !== "folded");
  if (live.length < 2) throw new Error("Only one player remains; award the pot without showdown");
  const street: Street = state.street === "preflop" ? "flop" : state.street === "flop" ? "turn" : state.street === "turn" ? "river" : "showdown";
  if (street === "showdown") return { ...state, street };
  const count = street === "flop" ? 3 : 1;
  const next = state.deckIndex;
  if (next + count >= state.deck.length) throw new Error("Deck exhausted");
  return {
    ...state, street,
    burns: [...state.burns, state.deck[next]],
    board: [...state.board, ...state.deck.slice(next + 1, next + 1 + count)],
    deckIndex: next + 1 + count,
  };
}

export function foldPlayer(state: HandState, id: string): HandState {
  const player = state.players.find(p => p.id === id);
  if (!player || player.status !== "active") throw new Error("Player cannot fold");
  return { ...state, players: state.players.map(p => p.id === id ? { ...p, status: "folded" as const } : p) };
}

/** Never reveal folded hole cards in a public snapshot. */
export function publicShowdown(state: HandState) {
  if (state.street !== "showdown") throw new Error("Not at showdown");
  return {
    street: state.street,
    board: state.board,
    players: state.players.map(p => ({ id: p.id, status: p.status, hole: p.status === "folded" ? null : p.hole })),
  };
}
