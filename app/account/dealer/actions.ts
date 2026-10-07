"use server";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEALER_GAMES } from "@/lib/dealers";
import { PREF_OPTIONS } from "@/lib/constants";
export async function saveDealer(_previous: { error: string }, form: FormData): Promise<{ error: string }> {
 const supabase = await createClient();
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) redirect("/login?next=/account/dealer/edit");
 const { data: suspended, error: suspendedError } = await supabase.rpc("is_suspended");
 if (suspendedError || suspended) return { error: "このアカウントでは登録できません。" };
 const name = String(form.get("name") ?? "").trim();
 const ageRaw = String(form.get("age") ?? "");
 const age = Number(ageRaw);
 const pref = String(form.get("pref") ?? "");
 const address = String(form.get("address") ?? "").trim();
 const games = [...new Set(form.getAll("games").map(String))];
 const yearsRaw = String(form.get("years") ?? "");
 const years = Number(yearsRaw);
 const appeal = String(form.get("appeal") ?? "").trim();
 const dates = [...new Set(form.getAll("availableDates").map(String))].sort();
 if (dates.length > 366 || dates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d+"T00:00:00Z")) || new Date(d+"T00:00:00Z").toISOString().slice(0,10) !== d)) return { error: "希望勤務日を確認してください。" };
 const type = String(form.get("dealerType") ?? "");
 if (!name || name.length > 100 || !ageRaw || !Number.isInteger(age) || age < 0 || age > 120 || !PREF_OPTIONS.includes(pref) || !address || address.length > 300 || !games.length || games.some(g => !DEALER_GAMES.includes(g)) || !yearsRaw || !Number.isFinite(years) || years < 0 || years > 80 || appeal.length > 3000 || !["ディーラー", "フリーディーラー"].includes(type)) return { error: "入力内容を確認してください。" };
 const { data: current, error: currentError } = await supabase.from("dealer_profiles").select("photo_url").eq("user_id", user.id).maybeSingle();
 if (currentError) return { error: "登録情報を読み込めませんでした。" };
 let photo = form.get("removePhoto") === "on" ? null : current?.photo_url ?? null;
 let avatar = String(form.get("avatarKind") ?? "") || null;
 if (avatar !== null && avatar !== "male" && avatar !== "female") return { error: "シルエットを選び直してください。" };
 if (avatar) photo = null;
 let uploaded: string | null = null;
 const image = form.get("photo");
 if (image instanceof File && image.size > 0) {
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[image.type];
  if (!ext || image.size > 3 * 1024 * 1024) return { error: "写真はJPEG・PNG・WebP、3MB以内で選んでください。" };
  uploaded = user.id + "/" + randomUUID() + "." + ext;
  const { error } = await supabase.storage.from("dealer-photos").upload(uploaded, image, { contentType: image.type });
  if (error) return { error: "写真をアップロードできませんでした。" };
  photo = uploaded;
  avatar = null;
 }
 const { error } = await supabase.rpc("save_dealer_profile_with_avatar", { p_name: name, p_age: age, p_pref: pref, p_address: address, p_games: games, p_years: years, p_appeal: appeal, p_photo: photo, p_type: type, p_published: form.get("published") === "on", p_dates: dates, p_avatar: avatar });
 if (error) {
  if (uploaded) await supabase.storage.from("dealer-photos").remove([uploaded]);
  return { error: "保存できませんでした。もう一度お試しください。" };
 }
 if (current?.photo_url && current.photo_url !== photo) await supabase.storage.from("dealer-photos").remove([current.photo_url]);
 revalidatePath("/account/dealer");
 revalidatePath("/account/dealer/edit");
 revalidatePath("/mypage");
 revalidatePath("/store/profile/dealers", "layout");
 redirect("/account/dealer?done=1");
}
