import Link from "next/link";
import { tournamentActor } from "@/lib/poker/tournament-admin";
import { loadTournamentAccess } from "@/lib/poker/tournament-access";
import AccessForm from "./access-form";
export default async function Page({searchParams}:{searchParams?:{q?:string;page?:string}}) {
    const { client } = await tournamentActor("admin");
    const q = String(searchParams?.q ?? "").trim().slice(0,100);
    const page = Math.min(100000,Math.max(1,Math.floor(Number(searchParams?.page)||1)));
    let query = client.from("stores").select("id,name",{count:"exact"});
    if (q) query = query.ilike("name",`%${q.replace(/[\\%_]/g,"\\$&")}%`);
    const { data: stores, count, error } = await query.order("name").order("id").range((page-1)*30,page*30-1);
    const access = await loadTournamentAccess(client,(stores ?? []).map(s=>s.id));
    const href=(p:number)=>`/admin/poker-tournaments/access?q=${encodeURIComponent(q)}&page=${p}`;
    return <section><h1>オンライン大会設定：店舗の利用許可</h1><p>初期状態は全店舗「未許可」です。許可した店舗だけがオンライン大会設定を編集できます。通常の店舗情報・イベント設定は引き続き使用できます。</p><p>許可を取り消しても、既存の大会・画像・公開状態は保持します。運営は大会設定を引き続き編集できます。</p>
        <Link className="btn" href="/admin/poker-tournaments">大会設定に戻る</Link>
        <form method="get" style={{display:"flex",flexWrap:"wrap",gap:8,margin:"16px 0"}}><label>店舗名で検索 <input name="q" defaultValue={q} maxLength={100}/></label><button className="btn">検索</button></form>
        {error || access.error ? <p role="alert">店舗の利用許可を読み込めませんでした。再読み込みしてください。</p> : <><p>{count ?? 0}店舗 ／ {page}ページ</p><div style={{display:"grid",gap:12}}>{(stores ?? []).map(s=><AccessForm key={s.id} store={{...s,enabled:access.enabledIds.has(s.id)}}/>)}</div><nav aria-label="店舗検索のページ" style={{display:"flex",gap:12,margin:"16px 0"}}>{page>1 && <Link className="btn" href={href(page-1)}>前へ</Link>}{page*30<(count ?? 0) && <Link className="btn" href={href(page+1)}>次へ</Link>}</nav></>}
    </section>;
}
