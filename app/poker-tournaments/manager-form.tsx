"use client";
import { useFormState, useFormStatus } from "react-dom";
import type { PokerTournament } from "@/lib/poker/tournament";
import type { TournamentFormState } from "@/lib/poker/tournament-admin";
import { toEventLocalInput } from "@/lib/event-dates";
import PrizeEditor from "./prize-editor";
import StructureEditor from "./structure-editor";
function Submit() { const { pending } = useFormStatus(); return <button className="btn primary" disabled={pending}>{pending ? "保存中…" : "設定を保存する"}</button>; }
export default function TournamentForm({ record, stores, admin, action, disabled = false }: {
    record?: PokerTournament;
    stores: {
        id: string;
        name: string;
    }[];
    admin: boolean;
    disabled?: boolean;
    action: (state: TournamentFormState, form: FormData) => Promise<TournamentFormState>;
}) {
    const [state, save] = useFormState(action, { ok: false, message: "" });
    return <form action={save} style={{ display: "grid", gap: 14, marginTop: 12 }}><fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0, display: "grid", gap: 14 }}><input type="hidden" name="id" value={state.id ?? record?.id ?? ""}/><label>大会名<input name="title" required maxLength={120} defaultValue={record?.title ?? ""}/></label><label>管理する主催店舗<select name="owner_store_id" required={!admin} defaultValue={record?.owner_store_id ?? (admin ? "" : stores[0]?.id ?? "")}>{admin && <option value="">Poker Summit事務局</option>}{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>主催者・コラボレーション名（自由記載）<input name="organizer_name" maxLength={200} defaultValue={record?.organizer_name ?? ""} placeholder="例：Poker Summit × ○○プロジェクト"/></label><small>店舗の管理権限は上の店舗設定に従います。自由記載は公開表示用です。</small><label>開始日時（日本時間）<input name="starts_at" required type="datetime-local" defaultValue={toEventLocalInput(record?.starts_at)}/></label><StructureEditor initial={record?.structure}/><PrizeEditor initial={record?.prizes}/><label>大会画像（PNG・JPEG・WebP、2MB以下）<input type="file" name="image" accept="image/png,image/jpeg,image/webp"/></label>{record?.image_url && <div><img src={record.image_url} alt={`${record.title}の大会画像`} style={{ maxWidth: 280, width: "100%", borderRadius: 8, opacity: 0.25 }}/><label><input type="checkbox" name="remove_image"/>現在の画像を削除</label></div>}<label><input type="checkbox" name="published" defaultChecked={record?.published ?? false}/>大会設定をロビーに公開する</label><small>公開は開催情報・ストラクチャーの掲載です。保存後、この大会の「参加対象者・自動開始」で対象会員を設定してください。</small><Submit /></fieldset>{state.message && <p role="status" style={{ color: state.ok ? "#298651" : "#b83232" }}>{state.message}</p>}</form>;
}
