import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { PrefSelector } from "@/app/pref-selector";
import { PrefGeoDetector } from "@/app/pref-geo-detector";
import { PREF_OPTIONS } from "@/lib/constants";
import { getCurrentPref } from "@/lib/current-pref";

function formatDateTime(value: string) {
  const d = new Date(value);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 店舗が「お知らせ管理」(app/store/(authenticated)/profile/notices)から
// 投稿したお知らせ(store_notices)を一般公開するページ。TOPページの
// PICK UP店舗などと同じ「現在表示中の都道府県」(lib/current-pref.ts)で
// 地域別に自動振り分けする(2026/10、「お知らせには店舗が入力した知らせを
// 流して」「地域別に自動振り分け」との指示)。ヘッダーナビの「お知らせ」
// リンクはここを指す(以前は誤って/contactを指していた)。
export default async function NewsPage() {
  const supabase = await createClient();
  const { pref: currentPref, source: currentPrefSource } = await getCurrentPref();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let noticesQuery = supabase
    .from("store_notices")
    .select("id, title, body, created_at, pref, store_id, stores(name, category)")
    .eq("status", "published");
  if (currentPref) noticesQuery = noticesQuery.eq("pref", currentPref);
  noticesQuery = noticesQuery
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  const { data: notices } = await noticesQuery;

  return (
    <div>
      <PortalHeader userEmail={user?.email} />

      {/* TOPページと同じ「現在表示中の都道府県」検出・切り替え UI */}
      <PrefGeoDetector skipDetect={currentPrefSource === "manual" || currentPrefSource === "geo"} />

      <div className="container" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <PrefSelector currentPref={currentPref} prefOptions={PREF_OPTIONS} />
      </div>

      <div className="container">
        <h1 style={{ fontSize: 22, marginTop: 16, marginBottom: 16 }}>
          📣 お知らせ{currentPref ? `（${currentPref}）` : "（全国）"}
        </h1>

        {(!notices || notices.length === 0) && (
          <p className="muted">
            {currentPref ? `${currentPref}にはまだお知らせがありません。` : "まだお知らせがありません。"}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notices?.map((n: any) => (
            <Link href={`/stores/${n.store_id}`} key={n.id} className="card" style={{ display: "block" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                {n.stores?.category && <span className="badge">{n.stores.category}</span>}
                {n.pref && <span className="badge outline">{n.pref}</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{n.title}</div>
              {n.body && (
                <p className="muted" style={{ fontSize: 13.5, marginBottom: 6, whiteSpace: "pre-wrap" }}>
                  {n.body}
                </p>
              )}
              <div className="muted" style={{ fontSize: 12 }}>
                {n.stores?.name} ・ {formatDateTime(n.created_at)}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <PortalFooter />
      <BottomTabs />
    </div>
  );
}
