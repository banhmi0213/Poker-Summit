"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendContactEmailChangedNotice, sendEmailVerificationCode } from "@/lib/email";
import { createStoreClient as createClient } from "@/lib/supabase/store-server";
import { normalizeCity } from "@/lib/city";
import {
  applyInstantStoreFieldsUpdate,
  hasPendingStoreChangeRequest,
  requestStoreFieldChange,
} from "@/lib/store-update";

export async function updateStoreProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const storeId = String(formData.get("storeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const pref = String(formData.get("pref") ?? "").trim();
  const address = String(formData.get("address") ?? "");
  // 番地入り・空欄でも「〇〇市」「〇〇区」に揃える(市区町村ページへの自動振り分け)
  const city = normalizeCity(pref, String(formData.get("city") ?? ""), address) ?? "";
  const tel = String(formData.get("tel") ?? "");
  const hours = String(formData.get("hours") ?? "");
  const nearestStation = String(formData.get("nearestStation") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const lineUrl = String(formData.get("lineUrl") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const xUrl = String(formData.get("xUrl") ?? "").trim();
  const instagramUrl = String(formData.get("instagramUrl") ?? "").trim();
  const areaKeywords = String(formData.get("areaKeywords") ?? "").trim();

  if (!name) {
    throw new Error("店舗名を入力してください。");
  }

  const { data: current, error: fetchError } = await supabase
    .from("stores")
    .select("id, name, pref, city, address")
    .eq("id", storeId)
    .eq("owner_user_id", user.id)
    .single();

  if (fetchError || !current) {
    throw new Error("この店舗を編集する権限がありません。");
  }

  const requestedBy = `web:${user.id}`;

  // 店名・住所は検索・地図・現在地検索・ナビに影響するため、即時反映せず
  // 運営承認後に反映する「変更申請」として保存する(store-update.ts参照)。
  // すでに承認待ちの申請がある場合は多重申請にせず、その旨だけ伝える。
  if (name !== (current.name ?? "")) {
    if (await hasPendingStoreChangeRequest(supabase, storeId, "name")) {
      throw new Error("店舗名の変更はすでに運営の承認待ちです。承認され次第、反映されます。");
    }
    await requestStoreFieldChange(supabase, {
      storeId,
      field: "name",
      currentValue: { name: current.name },
      proposedValue: { name },
      requestedBy,
    });
  }

  const addressChanged =
    pref !== (current.pref ?? "") ||
    city !== (current.city ?? "") ||
    address !== (current.address ?? "");
  if (addressChanged) {
    if (await hasPendingStoreChangeRequest(supabase, storeId, "address")) {
      throw new Error("住所の変更はすでに運営の承認待ちです。承認され次第、反映されます。");
    }
    await requestStoreFieldChange(supabase, {
      storeId,
      field: "address",
      currentValue: { pref: current.pref, city: current.city, address: current.address },
      proposedValue: {
        pref: pref || null,
        city: city || null,
        address: address || null,
      },
      requestedBy,
    });
  }

  // 上記以外は今まで通り即時反映 + 変更履歴を記録。
  await applyInstantStoreFieldsUpdate(supabase, storeId, "web", requestedBy, {
    category: category || null,
    tel,
    hours,
    nearestStation: nearestStation || null,
    description,
    lineUrl: lineUrl || null,
    email: email || null,
    xUrl: xUrl || null,
    instagramUrl: instagramUrl || null,
    areaKeywords: areaKeywords || null,
  });

  // 公開サイト側(店舗詳細ページ)と総合管理画面も、Web側からの更新を即座に
  // 反映する(LINE側 /api/liff/store の revalidate と揃える)。
  revalidatePath("/store/profile");
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/");
  revalidatePath("/stores", "layout");
  revalidatePath("/events", "layout");
  revalidatePath("/jobs", "layout");
  revalidatePath("/coupons", "layout");
  revalidatePath("/admin/stores");
}

// ---------------------------------------------------------------------------
// 店舗管理画面の「LINE・メールの登録をお願いします」アナウンスから呼ばれる
// 2つのアクション(2026/10、「全店舗有料掲載店にはLINE、メールアドレスの
// 登録をお願いします的な」との指示を受けて追加)。
// どちらも、store_contracts/store_link_codes への直接の書き込み権限が
// ない店舗オーナー自身のセッションから呼べるよう、security definer RPC
// (update_my_store_contact_email() / issue_my_store_line_link_code())
// を介している。RLS参照はそれぞれのRPCのコメントを参照。
// ---------------------------------------------------------------------------

// 連絡先メールアドレスの登録・変更は、新しいアドレスに確認コードを送り、
// コードの入力で本人の操作であることを確かめてから反映する(不正利用対策)。
// コードはDBに保存せず、署名付きのCookie(15分有効)で照合する。
const EMAIL_VERIFY_COOKIE = "ps_email_verify";
const EMAIL_VERIFY_MINUTES = 15;
const EMAIL_VERIFY_MAX_TRIES = 5;

function emailVerifySignature(userId: string, email: string, code: string, exp: number) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", `ps-email-verify:${key}`).update(`${userId}|${email}|${code}|${exp}`).digest("hex");
}

function backToProfile(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/store/profile?${qs}#notify-banner`);
}

export async function updateMyStoreContactEmail(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const contactEmail = String(formData.get("contactEmail") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactEmail.length > 254) {
    backToProfile({ emailError: "メールアドレスの形式が正しくありません。" });
  }

  // 送信回数の制限(1時間に5回まで)
  const svc = createServiceRoleClient();
  const { count: sentCount } = await svc
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "email_code_sent")
    .eq("target_id", user.id)
    .gte("created_at", new Date(Date.now() - 60 * 60_000).toISOString());
  if ((sentCount ?? 0) >= 5) {
    backToProfile({ emailError: "確認コードの送信回数が上限に達しました。1時間ほど時間をおいてからお試しください。" });
  }

  const code = String(randomInt(100000, 1000000));
  const exp = Date.now() + EMAIL_VERIFY_MINUTES * 60_000;
  const token = Buffer.from(
    JSON.stringify({ u: user.id, e: contactEmail, x: exp, h: emailVerifySignature(user.id, contactEmail, code, exp) })
  ).toString("base64url");

  try {
    await sendEmailVerificationCode({ to: contactEmail, code, minutes: EMAIL_VERIFY_MINUTES });
  } catch {
    backToProfile({ emailError: "確認コードのメールを送信できませんでした。アドレスをご確認のうえ、もう一度お試しください。" });
  }
  await svc.from("audit_log").insert({ actor_user_id: user.id, action: "email_code_sent", target_type: "store_contact_email", target_id: user.id, detail: {} });

  const jar = await cookies();
  jar.set(EMAIL_VERIFY_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/store",
    maxAge: EMAIL_VERIFY_MINUTES * 60,
  });
  backToProfile({ emailCode: "sent" });
}

export async function confirmMyStoreContactEmail(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const jar = await cookies();
  const raw = jar.get(EMAIL_VERIFY_COOKIE)?.value;
  let payload: { u: string; e: string; x: number; h: string } | null = null;
  try {
    payload = raw ? JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) : null;
  } catch {
    payload = null;
  }
  if (!payload || payload.u !== user.id || Date.now() > payload.x) {
    jar.delete({ name: EMAIL_VERIFY_COOKIE, path: "/store" });
    backToProfile({ emailError: "確認コードの有効期限が切れました。もう一度メールアドレスを入力してください。" });
  }

  const svc = createServiceRoleClient();
  const issuedAt = new Date(payload.x - EMAIL_VERIFY_MINUTES * 60_000).toISOString();
  const { count: failCount } = await svc
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "email_code_failed")
    .eq("target_id", user.id)
    .gte("created_at", issuedAt);
  if ((failCount ?? 0) >= EMAIL_VERIFY_MAX_TRIES) {
    jar.delete({ name: EMAIL_VERIFY_COOKIE, path: "/store" });
    backToProfile({ emailError: "確認コードの入力に続けて失敗したため、このコードは使えなくなりました。もう一度メールアドレスを入力してください。" });
  }

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const expected = Buffer.from(emailVerifySignature(user.id, payload.e, code, payload.x));
  const given = Buffer.from(payload.h);
  if (code.length !== 6 || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await svc.from("audit_log").insert({ actor_user_id: user.id, action: "email_code_failed", target_type: "store_contact_email", target_id: user.id, detail: {} });
    backToProfile({ emailCode: "sent", emailError: "確認コードが正しくありません。" });
  }

  const { data: store } = await svc.from("stores").select("id, name").eq("owner_user_id", user.id).maybeSingle();
  if (!store) backToProfile({ emailError: "店舗が見つかりません。運営にお問い合わせください。" });
  const { data: contract } = await svc
    .from("store_contracts")
    .select("id, contact_email")
    .eq("store_id", store.id)
    .eq("status", "active")
    .maybeSingle();
  if (!contract) backToProfile({ emailError: "有効な契約が見つかりません。運営にお問い合わせください。" });

  const previous = contract.contact_email as string | null;
  const { error } = await svc.from("store_contracts").update({ contact_email: payload.e }).eq("id", contract.id);
  if (error) backToProfile({ emailError: "メールアドレスを登録できませんでした。運営にお問い合わせください。" });
  await svc.from("audit_log").insert({
    actor_user_id: user.id,
    action: "store_contact_email_changed",
    target_type: "store_contract",
    target_id: contract.id,
    detail: { had_previous: Boolean(previous) },
  });
  jar.delete({ name: EMAIL_VERIFY_COOKIE, path: "/store" });

  // 変更前のアドレスにも知らせる(心当たりのない変更に気づけるように)
  if (previous && previous.toLowerCase() !== payload.e) {
    try {
      await sendContactEmailChangedNotice({ to: previous, storeName: store.name, newEmail: payload.e, at: new Date() });
    } catch {
      // 通知に失敗しても変更は完了している
    }
  }

  revalidatePath("/store/profile");
  backToProfile({ emailDone: "1" });
}

// LINE連携用ワンタイムコードを店舗オーナー自身が再発行する。発行結果
// (コード)は画面に表示する必要があるため、member-actions.ts の
// applyError/applyDone と同じく、クエリパラメータ経由で/store/profileに
// 戻す。
export async function issueMyStoreLineLinkCode() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("ログインが必要です。");
  }

  const { data: code, error } = await supabase.rpc("issue_my_store_line_link_code");
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/store/profile");
  redirect(`/store/profile?lineCode=${encodeURIComponent(String(code))}#notify-banner`);
}
