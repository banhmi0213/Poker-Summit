"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeMHoldemId, mHoldemIdError } from "@/lib/m-holdem";

// 先行登録の間(マイページを開けない間)に、先行会員が m HOLD'EM ID を登録する(2026/10/19)。
// 登録は1回だけ(set_my_m_holdem_id。変更不可・1IDは1アカウント)。
// 戻り先は /prelaunch(トップ "/" は先行登録モードでクエリが消えるため)
export async function registerPrelaunchMHoldemId(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const id = normalizeMHoldemId(formData.get("mHoldemId"));
  if (!id) redirect(`/prelaunch?mhError=${encodeURIComponent("m HOLD’EM IDを入力してください。")}`);
  const err = mHoldemIdError(id);
  if (err) redirect(`/prelaunch?mhError=${encodeURIComponent(err)}`);
  const { error } = await supabase.rpc("set_my_m_holdem_id", { p_id: id });
  if (error) redirect(`/prelaunch?mhError=${encodeURIComponent(error.message)}`);
  redirect("/prelaunch?mhDone=1");
}
