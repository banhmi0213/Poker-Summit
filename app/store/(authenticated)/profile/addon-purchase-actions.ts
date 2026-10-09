"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createStoreClient } from "@/lib/supabase/store-server";
import { purchaseAddon, cancelMonthlyAddon } from "@/lib/addon-orders";

// 店舗管理「プラン・お支払い」のアドオン購入・解約(2026/10)。
// 結果はページ上部のメッセージで表示する(例外で「Application error」にしない)。

async function ownStoreId() {
  const db = await createStoreClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/store/login?next=/store/profile/plan");
  const { data: store } = await db.from("stores").select("id").eq("owner_user_id", user.id).maybeSingle();
  if (!store) throw new Error("このアカウントに紐づく店舗が見つかりません。");
  return store.id as string;
}

async function settle(run: () => Promise<string>) {
  let message = "";
  let failed = false;
  try {
    message = await run();
  } catch (e) {
    if (typeof (e as { digest?: unknown })?.digest === "string" && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    failed = true;
    message = e instanceof Error ? e.message : String(e);
  }
  revalidatePath("/store/profile/plan");
  redirect(`/store/profile/plan?${failed ? "error" : "ok"}=${encodeURIComponent(message || "受け付けました。")}#addons`);
}

export async function purchaseAddonAction(formData: FormData) {
  await settle(async () => {
    const storeId = await ownStoreId();
    const addonId = String(formData.get("addonId") ?? "");
    const quantity = Number(formData.get("quantity") ?? 1);
    const paymentMethod = String(formData.get("paymentMethod") ?? "bank_transfer") === "card" ? "card" : "bank_transfer";
    const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
    if (!addonId) throw new Error("アドオンを選んでください。");
    return purchaseAddon({ storeId, addonId, quantity, paymentMethod, note });
  });
}

export async function cancelAddonAction(formData: FormData) {
  await settle(async () => {
    const storeId = await ownStoreId();
    const id = String(formData.get("storeContractAddonId") ?? "");
    if (!id) throw new Error("アドオンが指定されていません。");
    return cancelMonthlyAddon({ storeId, storeContractAddonId: id });
  });
}
