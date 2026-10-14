import { COUPON_CATEGORIES } from "@/lib/coupon-categories";

export function CouponCategorySelect({ value = "" }: { value?: string }) {
  return <fieldset className="field" style={{ border: 0, padding: 0, marginInline: 0 }}>
    <legend style={{ fontWeight: 700 }}>掲載カテゴリ（必須）</legend>
    <select name="offerType" required defaultValue={value} aria-label="掲載カテゴリ">
      <option value="" disabled>カテゴリを選択してください</option>
      {COUPON_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
    </select>
    <p className="small" style={{ margin: "8px 0", color: "#59432e" }}>選択したカテゴリのクーポン一覧に自動で掲載されます。特典の主な内容に合うものを１つ選んでください。</p>
    <ul className="small" style={{ margin: "0 0 8px", paddingLeft: 20 }}>
      {COUPON_CATEGORIES.map(c => <li key={c.value}><strong>{c.label}：</strong>{c.description}</li>)}
    </ul>
    {!value && <p className="small" style={{ color: "#795010" }}>未設定の既存クーポンは「すべて見る」に表示されます。保存時にカテゴリを選択してください。</p>}
  </fieldset>;
}
