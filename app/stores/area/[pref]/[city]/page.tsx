import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PREF_OPTIONS } from "@/lib/constants";
import StoresPage, { generateMetadata as storesMetadata } from "../../../page";

// 市区町村ページ(例: /stores/area/東京都/新宿区)。中身は店舗一覧ページを市区町村で絞ったもの。
type Params = { pref: string; city: string };
type Search = { page?: string; category?: string };

function decode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function toSearchParams(params: Params, searchParams: Search) {
  return { page: searchParams.page, category: searchParams.category, pref: decode(params.pref), city: decode(params.city) };
}

export function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
  return storesMetadata({ searchParams: toSearchParams(params, searchParams) });
}

export default function CityStoresPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const sp = toSearchParams(params, searchParams);
  if (!PREF_OPTIONS.includes(sp.pref) || !/^.{1,19}[市区町村]$/.test(sp.city)) notFound();
  return <StoresPage searchParams={toSearchParams(params, searchParams)} />;
}
