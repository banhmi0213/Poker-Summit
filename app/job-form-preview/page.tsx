import { JOB_TYPE_OPTIONS } from "@/lib/constants";
import { JobRoleSelect } from "@/app/job-role-select";
import Link from "next/link";
import s from "../store/(authenticated)/profile/manage.module.css";
export const metadata={title:"求人登録フォーム・確認用プレビュー"};
export default function JobFormPreview(){
 return <main className="container" style={{maxWidth:760,paddingTop:24,paddingBottom:48}}>
  <p className="badge outline">開発プレビュー・保存不可</p>
  <h1 style={{fontSize:22,margin:"14px 0"}}>求人登録フォームの表示確認</h1>
  <p className="muted">店舗ログイン不要のUI確認用です。入力しても保存・公開・通知はされません。実際の店舗管理画面と同じ入力項目を確認できます。</p>
  <details className={`card ${s.add}`} open>
   <summary><span className={s.plus} aria-hidden>＋</span>新しい求人を掲載する（確認用）</summary>
   <div className={s.addBody}>
    <div className="field"><span>求人タイトル</span><input placeholder="例：ディーラー募集（未経験歓迎）"/></div>
    <JobRoleSelect value=""/>
    <div className="field"><span>雇用形態</span><select defaultValue=""><option value="">選択してください</option>{JOB_TYPE_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
    <div className="field"><span>給与</span><input placeholder="例：時給1,300円〜"/></div>
    <div className="field"><span>応募対象・経験</span><select defaultValue="any"><option value="any">経験不問</option><option value="beginner">未経験歓迎</option><option value="experienced">経験者募集</option></select></div>
    <div className="field"><span>研修制度・研修中の条件</span><textarea rows={2} placeholder="例：未経験者向け研修あり（研修中の時給・期間も記載）"/></div>
    <div className="field"><span>交通費・支給条件</span><input placeholder="例：交通費支給（1日上限1,000円）"/></div>
    <div className="field"><span>募集期限（任意）</span><input type="date"/></div>
    <div className="field"><span>仕事内容</span><textarea rows={4}/></div>
    <div className="field"><span>バナー画像（任意）</span><input type="file" accept="image/*"/></div>
    <button type="button" className="btn" disabled>求人を掲載する（確認用のため無効）</button>
   </div>
  </details>
  <p className="muted small" style={{marginTop:16}}>このページはフォーム表示のみを確認するためのものです。データベースへの書き込み処理はありません。</p>
  <Link href="/jobs" className="btn">求人一覧へ</Link>
 </main>
}
