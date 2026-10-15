import { createClient } from "@/lib/supabase/server";
import { createStoreClient } from "@/lib/supabase/store-server";
import { validateTournamentDetails, validateStructure, type PokerTournament } from "./tournament";
import { parseEventLocalInput } from "@/lib/event-dates";
import { assertAllowedStoreText } from "@/lib/content-rules";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
export type TournamentFormState = {
    ok: boolean;
    message: string;
    id?: string;
};
const columns = "id,title,owner_store_id,starts_at,published,structure,image_url,image_path,organizer_name,prizes";
export async function tournamentManager(scope: "admin" | "store") {
    const client = scope === "admin" ? await createClient() : await createStoreClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user)
        throw new Error("ログインが必要です。");
    const suspended = await client.rpc("is_suspended");
    if (suspended.error || suspended.data === true)
        throw new Error("このアカウントでは大会設定を操作できません。");
    if (scope === "admin") {
        const { data, error } = await client.rpc("is_admin");
        if (error || data !== true)
            throw new Error("運営権限が必要です。");
    }
    let stores = client.from("stores").select("id,name");
    if (scope === "store")
        stores = stores.eq("owner_user_id", user.id);
    const { data: owned, error } = await stores.order("name");
    if (error)
        throw new Error(error.message);
    return { client, user, stores: owned ?? [] };
}
export async function loadManagedTournaments(scope: "admin" | "store") {
    const context = await tournamentManager(scope);
    let query = context.client.from("poker_tournaments").select(columns).order("starts_at");
    if (scope === "store")
        query = query.in("owner_store_id", context.stores.map(s => s.id));
    const { data, error } = await query;
    if (error)
        return { ...context, rows: [] as PokerTournament[], error: error.code === "42P01" || error.code === "PGRST205" ? "大会設定の保存先が未準備です。運営側でDBマイグレーションの適用が必要です。" : "大会設定を読み込めませんでした。時間をおいて再度お試しください。" };
    return { ...context, rows: (data ?? []) as PokerTournament[], error: null };
}
export async function saveManagedTournament(scope: "admin" | "store", form: FormData): Promise<TournamentFormState> {
    let uploaded: string | null = null;
    let cleanup: (() => Promise<unknown>) | null = null;
    try {
        const { client, user, stores } = await tournamentManager(scope);
        const id = String(form.get("id") ?? "");
        if (id && !/^[a-f0-9-]{36}$/i.test(id))
            throw new Error("大会IDを確認してください。");
        const owner = String(form.get("owner_store_id") ?? "") || null;
        if ((owner && !stores.some(s => s.id === owner)) || (scope === "store" && !owner))
            throw new Error("主催店舗の権限を確認してください。");
        const title = String(form.get("title") ?? "").trim();
        if (!title || title.length > 120)
            throw new Error("大会名は1〜120文字で入力してください。");
        const starts_at = parseEventLocalInput(String(form.get("starts_at") ?? ""));
        if (!starts_at)
            throw new Error("開始日時を入力してください。");
        const json = String(form.get("structure") ?? "");
        if (json.length > 60000)
            throw new Error("ストラクチャーが大きすぎます。");
        const structure = validateStructure(JSON.parse(json));
        if (scope === "store")
            assertAllowedStoreText(title, ...structure.periods.map(p => p.note));
        const prizeJson = String(form.get("prizes") ?? "[]");
        if (prizeJson.length > 100000) throw new Error("プライズ設定が大きすぎます。");
        const details = validateTournamentDetails(String(form.get("organizer_name") ?? ""), JSON.parse(prizeJson));
        if (scope === "store") assertAllowedStoreText(details.organizer_name, ...details.prizes.map(p => p.description));
        const published = form.get("published") === "on";
        let existing: PokerTournament | null = null;
        if (id) {
            const { data, error } = await client.from("poker_tournaments").select(columns).eq("id", id).maybeSingle();
            if (error || !data)
                throw new Error("この大会を編集できません。");
            existing = data as PokerTournament;
            if (scope === "store" && !stores.some(s => s.id === existing!.owner_store_id))
                throw new Error("編集権限がありません。");
        }
        let image_url = existing?.image_url ?? null, image_path = existing?.image_path ?? null;
        if (form.get("remove_image") === "on") {
            image_url = null;
            image_path = null;
        }
        const file = form.get("image");
        if (file instanceof File && file.size) {
            if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
                throw new Error("画像はPNG・JPEG・WebP、2MB以下でアップロードしてください。");
            const bytes = new Uint8Array(await file.arrayBuffer());
            const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
            const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
            const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
            if (!((file.type === "image/png" && png) || (file.type === "image/jpeg" && jpg) || (file.type === "image/webp" && webp)))
                throw new Error("画像形式が一致しません。");
            image_path = `${user.id}/${randomUUID()}.${png ? "png" : jpg ? "jpg" : "webp"}`;
            const { error } = await client.storage.from("poker-tournament-images").upload(image_path, bytes, { contentType: file.type, upsert: false });
            if (error)
                throw new Error("画像を保存できません。保存先の準備状況をご確認ください。");
            uploaded = image_path;
            cleanup = () => client.storage.from("poker-tournament-images").remove([uploaded!]);
            image_url = client.storage.from("poker-tournament-images").getPublicUrl(image_path).data.publicUrl;
        }
        const payload = { ...details, title, owner_store_id: owner, starts_at, published, structure, image_url, image_path };
        const result = id ? await client.from("poker_tournaments").update(payload).eq("id", id).select("id").single() : await client.from("poker_tournaments").insert(payload).select("id").single();
        if (result.error || !result.data)
            throw new Error("大会設定を保存できませんでした。DBの準備状況と権限をご確認ください。");
        uploaded = null;
        cleanup = null;
        if (existing?.image_path && existing.image_path !== image_path)
            await client.storage.from("poker-tournament-images").remove([existing.image_path]);
        for (const path of ["/admin/poker-tournaments", "/store/profile/poker-tournaments", "/poker-lobby", "/poker-demo"])
            revalidatePath(path);
        return { ok: true, message: published ? "大会設定を公開しました。参加受付・実際の対戦はまだ提供していません。" : "下書きとして保存しました。", id: result.data.id };
    }
    catch (error) {
        if (uploaded && cleanup)
            await cleanup();
        return { ok: false, message: error instanceof Error ? error.message : "保存に失敗しました。" };
    }
}
