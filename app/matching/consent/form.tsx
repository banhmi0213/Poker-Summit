"use client";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { TERMS_VERSION, PRIVACY_VERSION, MATCHING_RULES_VERSION } from "@/lib/legal";
import { acceptMatchingRules } from "./actions";
function Submit() { const { pending } = useFormStatus(); return <button className="btn primary" type="submit" disabled={pending} style={{ width: "100%", minHeight: 44 }}>{pending ? "同意を記録中…" : "同意して進む"}</button>; }
export function MatchingConsentForm({ actor, next }: { actor: "store" | "dealer"; next: string }) {
 const [state, action] = useFormState(acceptMatchingRules.bind(null, actor), { error: "", done: false });
 if (state.done) return <div className="card"><h2 style={{ fontSize: 18 }}>同意を記録しました</h2><p role="status">この規約・注意事項への同意が完了しました。</p><Link className="btn" href={actor === "store" ? "/store/profile" : "/mypage"}>戻る</Link></div>;
 return <form action={action} className="card" style={{ padding: 24 }}>
  <h2 style={{ fontSize: 19 }}>スポット勤務・マッチングご利用前の確認</h2>
  <p style={{ fontSize: 13, lineHeight: 1.8 }}>店舗・ディーラーのどちらも、利用前に以下をご確認ください。</p>
  <ul style={{ paddingLeft: 22, lineHeight: 1.9, fontSize: 14 }}>
   <li>条件の相談や変更はサイト内で連絡し、手続きを回避するLINE等への外部誘導を行わない。</li>
   <li>契約形態・日時・報酬・交通費・支払日と方法を当事者が確認し、合意内容を残す。</li>
   <li>ハラスメント、威圧、悪質な勧誘を行わず、不要な個人情報やカード情報等を送らない。</li>
   <li>問題があれば運営へ相談する。運営は必要な記録を確認する場合がある。</li>
  </ul>
  <p style={{ fontSize: 12, lineHeight: 1.8 }}>運営は採用判断・契約締結・報酬支払いを代行しません。この同意は、相手方の個別の勤務条件への承諾とは別です。</p>
  <p style={{ fontSize: 13 }}><Link href="/matching-guide" target="_blank" rel="noopener noreferrer">利用ガイドを読む</Link></p>
  <input type="hidden" name="next" value={next} />
  <input type="hidden" name="termsVersion" value={TERMS_VERSION} /><input type="hidden" name="privacyVersion" value={PRIVACY_VERSION} /><input type="hidden" name="rulesVersion" value={MATCHING_RULES_VERSION} />
  <label style={{ display: "flex", alignItems: "flex-start", gap: 9, margin: "20px 0", minHeight: 44, fontSize: 13, lineHeight: 1.8 }}><input type="checkbox" name="agree" value="yes" required style={{ marginTop: 5, flexShrink: 0 }} /><span><Link href="/terms" target="_blank" rel="noopener noreferrer">利用規約</Link>・<Link href="/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</Link>と、上記の注意事項・外部誘導に関するルールを確認し、同意します。</span></label>
  {state.error && <p className="err" role="alert">{state.error}</p>}
  <Submit /><p style={{ fontSize: 11, color: "#75644e", marginBottom: 0 }}>規約・ポリシー・注意事項：{MATCHING_RULES_VERSION}</p>
 </form>;
}

