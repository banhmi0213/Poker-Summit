"use server";
import { tournamentActor } from "@/lib/poker/tournament-admin";
import { revalidatePath } from "@/lib/revalidate";
export type AccessFormState = { ok: boolean; message: string; enabled?: boolean };
export async function saveAccess(_previous: AccessFormState, form: FormData): Promise<AccessFormState> {
    try {
        const { client } = await tournamentActor("admin");
        const storeId = String(form.get("store_id") ?? "");
        const raw = form.get("enabled");
        if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(storeId) || (raw !== "true" && raw !== "false")) throw new Error("店舗と許可状態を確認してください。");
        const enabled = raw === "true";
        const { error } = await client.from("poker_tournament_store_access").upsert({ store_id: storeId, enabled, updated_at: new Date().toISOString() }, { onConflict: "store_id" }).select("store_id").single();
        if (error) throw new Error("利用許可を保存できませんでした。店舗情報と権限を確認してください。");
        revalidatePath("/admin/poker-tournaments/access");
        revalidatePath("/store", "layout");
        return { ok: true, enabled, message: enabled ? "この店舗の利用を許可しました。" : "この店舗の利用許可を取り消しました。" };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "保存に失敗しました。" };
    }
}
