import Link from "next/link";
import { loadManagedTournaments, type TournamentFormState } from "@/lib/poker/tournament-admin";
import TournamentForm from "./manager-form";
export default async function TournamentManager({ scope, action }: {
    scope: "admin" | "store";
    action: (state: TournamentFormState, form: FormData) => Promise<TournamentFormState>;
}) {
    const { rows, stores, error } = await loadManagedTournaments(scope);
    return <section><h1>オンライン・トーナメント設定</h1><p>開催日時、画像、ブラインド・ストラクチャー、公開状態を管理します。</p>{error && <p role="alert">{error}</p>}{scope === "store" && !stores.length ? <p>管理できる店舗が見つかりません。</p> : <><details className="card"><summary>＋ トーナメント設定を登録</summary><TournamentForm stores={stores} admin={scope === "admin"} action={action} disabled={Boolean(error)}/></details>{rows.map(row => <details className="card" key={row.id}><summary>{row.title} — {row.published ? "公開中" : "下書き"}</summary>{row.published ? <Link className="btn" href={`/poker-demo?tournament=${row.id}`}>テーブル表示を確認（会員ログイン）</Link> : <p>下書きはロビーに表示されません。ストラクチャーは下の編集欄で確認できます。</p>}<TournamentForm record={row} stores={stores} admin={scope === "admin"} action={action}/></details>)}</>}<Link className="btn" href="/poker-tournaments/preview">保存せずに設定欄を試す</Link> <Link className="btn" href="/poker-demo?game=tournament">サンプルのタイマー・ストラクチャーを見る</Link></section>;
}
