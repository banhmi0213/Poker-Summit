import RemovalForm from './removal-form';
import Link from "next/link";
import { loadManagedTournaments, type TournamentFormState } from "@/lib/poker/tournament-admin";
import { TOURNAMENT_ACCESS_MESSAGE } from "@/lib/poker/tournament-access";
import TournamentForm from "./manager-form";
export default async function TournamentManager({ scope, action, removeAction }: {
    scope: "admin" | "store";
    removeAction?: (state:TournamentFormState,form:FormData)=>Promise<TournamentFormState>;
    action: (state: TournamentFormState, form: FormData) => Promise<TournamentFormState>;
}) {
    const { rows, stores, error, accessError } = await loadManagedTournaments(scope);
    const admin = scope === "admin";
    const allowedStores = stores.filter(s => s.tournamentEnabled);
    const locked = !admin && allowedStores.length === 0;
    return <section><h1>オンライン・トーナメント設定</h1>
        <p>開催日時、画像、ブラインド・ストラクチャー、公開状態を管理します。</p>
        {admin && <Link className="btn" href="/admin/poker-tournaments/access">店舗ごとの利用許可を管理</Link>}
        {admin&&<Link className="btn" href="/admin/poker-rings">リング卓設定</Link>}
        {error && <p role="alert">{error}</p>}
        {accessError && <p role="alert">利用許可を確認できないため、設定変更を停止しています。再読み込みしてお試しください。</p>}
        {locked && <p role="status">{TOURNAMENT_ACCESS_MESSAGE}</p>}
        {!admin && !stores.length ? <p>管理できる店舗が見つかりません。</p> : <>
            <details className="card" style={locked ? {opacity:.5, background:"#eee"} : undefined}>
                <summary>＋ トーナメント設定を登録{locked ? "（利用未許可）" : ""}</summary>
                <TournamentForm stores={locked ? stores : allowedStores} admin={admin} action={action} disabled={Boolean(error) || locked}/>
            </details>
            {rows.map(row => {
                const rowLocked = !admin && !allowedStores.some(s => s.id === row.owner_store_id);
                return <details className="card" key={row.id} style={rowLocked ? {opacity:.5, background:"#eee"} : undefined}>
                    <summary>{row.title} — {row.published ? "公開中" : "下書き"}{rowLocked ? "（利用未許可）" : ""}</summary>
                    {rowLocked && <p>{TOURNAMENT_ACCESS_MESSAGE}</p>}
                    {row.published ? <Link className="btn" href={`/poker-demo?tournament=${row.id}`}>テーブル表示を確認（会員ログイン）</Link> : <p>下書きはロビーに表示されません。</p>}
                    {admin&&removeAction&&<RemovalForm kind="tournament" id={row.id} title={row.title} action={removeAction}/>}
                    <TournamentForm record={row} stores={rowLocked ? stores : allowedStores} admin={admin} action={action} disabled={Boolean(error) || rowLocked}/>
                </details>;
            })}
        </>}
        {(admin || !locked) && <><Link className="btn" href="/poker-tournaments/preview">保存せずに設定欄を試す</Link> <Link className="btn" href="/poker-demo?game=tournament">サンプルのタイマー・ストラクチャーを見る</Link></>}
    </section>;
}
