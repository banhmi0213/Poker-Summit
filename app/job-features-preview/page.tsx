"use client";
import { useState } from "react";
import Link from "next/link";
type Level="any"|"beginner"|"experienced";
type View="list"|"detail"|"store"|"alerts";
const demo=[
 {id:"a",title:"ディーラースタッフ募集（未経験歓迎）",store:"サミットポーカー 渋谷店（デモ）",pref:"東京都",type:"アルバイト",salary:"時給1,300円〜",level:"beginner" as Level,training:"未経験者向け研修あり（研修期間中も時給支給）",travel:"交通費支給（1日上限1,000円）",deadline:"2026-12-31",description:"ポーカーディーラー業務、受付、店舗運営補助"},
 {id:"b",title:"経験者ディーラー・フロアスタッフ募集",store:"サミットポーカー 大阪店（デモ）",pref:"大阪府",type:"契約社員",salary:"月給240,000円〜",level:"experienced" as Level,training:"経験者向け運営研修あり",travel:"交通費全額支給（規定あり）",deadline:"2026-12-20",description:"トーナメント進行、ディーラー業務、フロア管理"},
 {id:"c",title:"ポーカーバー運営スタッフ募集",store:"サミットポーカー 東京店（デモ）",pref:"東京都",type:"正社員",salary:"月給220,000円〜",level:"any" as Level,training:"入社時研修あり",travel:"交通費規定支給",deadline:"2026-12-25",description:"接客・受付・ポーカーイベント運営"}
];
const levelLabel=(l:Level)=>l==="beginner"?"未経験歓迎":l==="experienced"?"経験者募集":"経験不問";
export default function JobFeaturesPreview(){
 const [view,setView]=useState<View>("list");
 const [experience,setExperience]=useState<Level|"">("");
 const [pref,setPref]=useState("");
 const [jobId,setJobId]=useState("a");
 const [enabled,setEnabled]=useState(false);
 const [alertPref,setAlertPref]=useState("");
 const [alertLevel,setAlertLevel]=useState<Level>("any");
 const [saved,setSaved]=useState(false);
 const [demoNew,setDemoNew]=useState(false);
 const [closedIds,setClosedIds]=useState<string[]>([]);
 const selected=demo.find(j=>j.id===jobId)||demo[0];
 const matches=(l:Level,filter:Level|"")=>!filter||filter==="any"||l==="any"||l===filter;
 const filtered=demo.filter(j=>(!pref||j.pref===pref)&&matches(j.level,experience));
 const alerts=demoNew&&enabled?demo.filter(j=>!closedIds.includes(j.id)&&(!alertPref||j.pref===alertPref)&&matches(j.level,alertLevel)):[];
 return <main className="container" style={{maxWidth:900,padding:"24px 12px 64px"}}>
  <span className="badge outline">開発プレビュー・サンプルデータのみ</span>
  <h1 style={{fontSize:23,margin:"12px 0"}}>求人機能の確認ページ</h1>
  <p className="muted">店舗アカウント不要。以下は架空の求人3件を使用した表示・操作のデモです。実際の求人登録・通知保存・応募・データベース更新は一切行いません。</p>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"20px 0"}}>
   {([["list","求人一覧・絞り込み"],["detail","求人詳細"],["store","店舗詳細の求人"],["alerts","マイページ新着通知"]] as const).map(([key,label])=>
    <button key={key} type="button" className={`btn ${view===key?"primary":""}`} onClick={()=>setView(key)}>{label}</button>)}
  </div>
  {view==="list"&&<section>
   <h2 style={{fontSize:20}}>求人を探す <small className="muted">新着順・デモ</small></h2>
   <div className="card" style={{padding:16,display:"flex",gap:12,flexWrap:"wrap",margin:"14px 0"}}>
    <label>都道府県 <select value={pref} onChange={e=>setPref(e.target.value)}><option value="">全国</option><option>東京都</option><option>大阪府</option></select></label>
    <label>経験条件 <select value={experience} onChange={e=>setExperience(e.target.value as Level|"")}><option value="">すべて</option><option value="beginner">未経験歓迎</option><option value="experienced">経験者募集</option></select></label>
   </div>
   <p className="muted small">{filtered.length}件の求人</p>
   {filtered.length===0&&<p className="card" style={{padding:18}}>条件に合う求人が見つかりませんでした。</p>}
   {filtered.map(j=><article key={j.id} className="card" style={{padding:18,marginBottom:12}}>
    <h3 style={{fontSize:17,marginBottom:8}}>{j.title}</h3>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><span className="badge outline">{j.type}</span><span className="badge outline">{levelLabel(j.level)}</span></div>
    <p className="muted small" style={{margin:"10px 0"}}>{j.store} ・ {j.pref}</p>
    <p>{j.salary}</p>
    <button className="btn" type="button" onClick={()=>{setJobId(j.id);setView("detail")}}>求人の詳細を見る ›</button>
   </article>)}
  </section>}
  {view==="detail"&&<section>
   <button className="btn" onClick={()=>setView("list")}>‹ 求人一覧に戻る</button>
   <article className="card" style={{padding:20,marginTop:14}}>
    <h2 style={{fontSize:21}}>{selected.title}</h2>
    <p className="muted">{selected.store} ・ {selected.pref}</p>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",margin:"12px 0"}}><span className="badge outline">{selected.type}</span><span className="badge outline">{levelLabel(selected.level)}</span></div>
    <h3 style={{fontSize:17,marginTop:20}}>募集要項</h3>
    <p><strong>給与：</strong>{selected.salary}</p>
    <p><strong>研修：</strong>{selected.training}</p>
    <p><strong>交通費：</strong>{selected.travel}</p>
    <p><strong>募集期限：</strong>{selected.deadline}</p>
    <p><strong>仕事内容：</strong>{selected.description}</p>
    <button className="btn" type="button" disabled>応募する（デモでは無効）</button>
   </article>
  </section>}
  {view==="store"&&<section>
   <h2 style={{fontSize:20}}>店舗詳細：求人情報（デモ）</h2>
   <p className="muted">サミットポーカー 渋谷店（架空の店舗）</p>
   <div className="card" style={{padding:18,marginTop:14}}>
    <h3 style={{fontSize:18}}>求人情報（1件）</h3>
    <h4 style={{margin:"14px 0 6px"}}>{demo[0].title}</h4>
    <span className="badge outline">{demo[0].type}</span> <span className="badge outline">{levelLabel(demo[0].level)}</span>
    <p style={{margin:"10px 0"}}>{demo[0].salary}</p>
    <button type="button" className="btn" onClick={()=>{setJobId("a");setView("detail")}}>求人の詳細を見る ›</button>
   </div>
  </section>}
  {view==="alerts"&&<section>
   <h2 style={{fontSize:20}}>マイページ：新着求人通知（デモ）</h2>
   <p className="muted small">通知の保存・配信は行いません。表示条件を操作して確認するためのデモです。</p>
   <div className="card" style={{padding:18,margin:"14px 0"}}>
    <label style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);setSaved(false)}}/>新着求人通知をONにする</label>
    <div className="field"><span>希望勤務地</span><select value={alertPref} onChange={e=>{setAlertPref(e.target.value);setSaved(false)}}><option value="">全国</option><option>東京都</option><option>大阪府</option></select></div>
    <div className="field"><span>経験条件</span><select value={alertLevel} onChange={e=>{setAlertLevel(e.target.value as Level);setSaved(false)}}><option value="any">すべて</option><option value="beginner">未経験歓迎</option><option value="experienced">経験者募集</option></select></div>
    <button type="button" className="btn primary" onClick={()=>setSaved(true)}>通知設定を保存する（デモ）</button>
    {saved&&<p style={{marginTop:10}}>設定を画面内に反映しました（サーバーには保存していません）。</p>}
   </div>
   <div className="card" style={{padding:18}}>
    <h3 style={{fontSize:17}}>条件に合う新着求人（{alerts.length}件）</h3>
    <p className="muted small">テスト通知を発生させるとデモ求人を「新着」として表示します。募集終了にした求人は通知一覧から自動的に消えます。</p>
    <button className="btn" type="button" onClick={()=>{setDemoNew(v=>!v);setClosedIds([])}}>{demoNew?"テスト通知を解除":"テスト新着求人を発生させる"}</button>
    {alerts.length===0&&<p className="muted small" style={{marginTop:12}}>条件に合う新着求人はありません。</p>}
    {alerts.map(j=><p key={j.id} style={{margin:"12px 0",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><button type="button" className="btn" onClick={()=>{setJobId(j.id);setView("detail")}}>{j.title} ›</button> <span className="muted small">{j.pref}</span><button type="button" className="btn" onClick={()=>setClosedIds(ids=>[...ids,j.id])}>募集終了を試す</button></p>)}
   </div>
  </section>}
  <p className="muted small" style={{marginTop:24}}>※ このページはデザイン・画面遷移・絞り込みの動作確認用です。本番機能の実データ連携テストを代替するものではありません。</p>
  <Link href="/job-form-preview" className="btn">求人登録フォームの確認ページへ</Link>
 </main>;
}
