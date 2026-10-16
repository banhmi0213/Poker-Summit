"use server";

import { searchStoreCandidates, type StoreCandidate } from "@/lib/store-match";

/** 申込みフォームの「このお店ですか？」候補(店名・電話番号・住所のうち2つ以上一致) */
export async function findStoreCandidates(input: { name: string; tel: string; pref: string; address: string }): Promise<StoreCandidate[]> {
  return searchStoreCandidates(input);
}
