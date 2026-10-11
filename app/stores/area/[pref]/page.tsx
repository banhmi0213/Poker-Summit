import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PREF_OPTIONS } from "@/lib/constants";
import StoresPage, { generateMetadata as storesMetadata } from "../../page";

// 都道府県ページ(例: /stores/area/東京都)。中身は店舗一覧ページを都道府県で絞ったもの。
// 「東京 ポーカー」のような検索に当てるため、クエリ文字列ではなくパスのURLを正とする。
type Params = { pref: string };
type Search = { page?: string; category?: string };

function decode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function toSearchParams(params: Params, searchParams: Search) {
  return { page: searchParams.page, category: searchParams.category, pref: decode(params.pref) };
}

export function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  return storesMetadata({ searchParams: toSearchParams(params, searchParams) });
}

export default function PrefStoresPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const sp = toSearchParams(params, searchParams);
  if (!PREF_OPTIONS.includes(sp.pref)) notFound();
  return <StoresPage searchParams={sp} />;
}
