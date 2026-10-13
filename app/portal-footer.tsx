import { unstable_cache } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";
import { PREF_OPTIONS, PREF_REGION, REGIONS } from "@/lib/constants";
import { prefPageHref } from "@/lib/city";
import { getPrefStoreCounts } from "@/lib/pref-counts";

// フッターの問い合わせ先メール(管理画面で変えたら最大5分で反映)
const getFooterSettings = unstable_cache(
  async () => {
    const { data } = await createAnonClient().from("site_settings").select("contact_email").eq("id", true).maybeSingle();
    return (data as { contact_email: string | null } | null) ?? null;
  },
  ["footer-settings-v1"],
  { revalidate: 300 }
);

export async function PortalFooter() {
  // どちらも全ページ共通なのでキャッシュから取る(2026/10、表示速度対策)
  const [settings, prefCounts] = await Promise.all([
    getFooterSettings().catch(() => null),
    getPrefStoreCounts().catch(() => ({} as Record<string, number>)),
  ]);
  // 地方ごとに、掲載店舗がある都道府県へのリンクを並べる(全ページから都道府県ページへたどれるようにする)
  const areaRows = REGIONS.map((region) => ({
    region,
    prefs: PREF_OPTIONS.filter((p) => PREF_REGION[p]?.[0] === region && (prefCounts[p] ?? 0) > 0),
  })).filter((r) => r.prefs.length > 0);

  return (
    <div className="portal-footer">
      {areaRows.length > 0 && (
        <nav className="footer-areas" aria-label="都道府県からポーカー店を探す">
          <p className="footer-areas__title">都道府県からポーカー店を探す</p>
          {areaRows.map((row) => (
            <div key={row.region} className="footer-areas__row">
              <span className="footer-areas__region">{row.region}</span>
              {row.prefs.map((p) => (
                <a key={p} href={prefPageHref(p)}>
                  {p.replace(/[都府県]$/, "")}
                </a>
              ))}
            </div>
          ))}
        </nav>
      )}
      Poker Summit — 全国のポーカースポット・求人・交流をつなぐポータル
      <br />
      <a href="/contact" className="btn" style={{ fontSize: 12.5, padding: "4px 8px", marginTop: 6, display: "inline-flex" }}>
        ✉️ お問い合わせ
      </a>
      <br />
      {settings?.contact_email && (
        <>
          <span className="muted">
            サポート窓口: <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
          </span>
          <br />
        </>
      )}
      <div style={{ maxWidth: 1140, margin: "16px auto", padding: "12px 16px", borderTop: "1px solid #ded5c5", borderBottom: "1px solid #ded5c5", textAlign: "left", fontSize: 13, lineHeight: 1.7 }}>
        <p style={{ margin: "0 0 3px" }}>
          本サービスはアミューズメントポーカーの情報ポータルです。金銭・物品を賭ける行為や換金サービスを提供しません。
        </p>
        <p style={{ margin: "0 0 3px" }}>
          国内アミューズメント店舗の掲載条件として、リアルマネーの賭けおよびチップ・ポイント等の換金を禁止しています。
        </p>
        <p style={{ margin: 0 }}>
          決済対象は店舗掲載プラン・広告・アドオン等のサービス利用料金です。
        </p>
        <div style={{ marginTop: 5, textAlign: "left" }}>
          <a href="/terms#amusement-policy" style={{ display: "inline-block", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>詳しくは利用規約へ</a>
        </div>
      </div>
      <nav className="footer-links" aria-label="フッターリンク">
        <a href="/terms">利用規約</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/privacy">プライバシーポリシー</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/disclaimer">免責事項</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/tokushoho">特定商取引法に基づく表記</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/company">運営会社概要</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a href="/contact">お問い合わせ</a>
        <span className="footer-links__separator footer-links__apply-separator" aria-hidden="true"> ｜ </span>
        <a className="footer-links__apply" href="/apply">掲載希望の店舗様へ</a>
        <span className="footer-links__separator" aria-hidden="true"> ｜ </span>
        <a className="footer-links__apply" href="/store/login">店舗管理画面</a>
      </nav>
      <div className="footer-copyright">© 2026 Poker Summit All Rights Reserved.</div>
      <div className="footer-store-actions">
        <a className="footer-apply-mobile" href="/apply">掲載希望の店舗様へ</a>
        <a className="footer-apply-mobile" href="/store/login">店舗管理画面</a>
      </div>
    </div>
  );
}
