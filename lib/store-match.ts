import "server-only";
import { createAnonClient } from "@/lib/supabase/anon";

// 掲載申込みを、掲載中の店舗と結び付けるための候補探し(2026/10)。
// 店名・電話番号・住所のうち2つ以上が一致した店舗だけを候補にする(DB関数 search_store_candidates_v2)。
export type StoreCandidate = {
  id: string;
  name: string;
  pref: string | null;
  city: string | null;
  address: string | null;
  has_owner: boolean;
  name_match: boolean;
  tel_match: boolean;
  address_match: boolean;
  match_count: number;
};

export async function searchStoreCandidates(input: { name: string; tel: string; pref: string; address: string }): Promise<StoreCandidate[]> {
  const name = input.name.trim().slice(0, 100);
  const tel = input.tel.trim().slice(0, 30);
  const address = input.address.trim().slice(0, 200);
  if (!name && !tel && !address) return [];
  const { data, error } = await createAnonClient().rpc("search_store_candidates_v2", {
    p_name: name,
    p_tel: tel,
    p_pref: input.pref.trim(),
    p_address: address,
  });
  if (error) return [];
  return (data ?? []) as StoreCandidate[];
}
