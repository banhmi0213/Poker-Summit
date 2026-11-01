"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREVIEW_COOKIE, normalizePreviewId, previewToken } from "@/lib/preview-access";

export async function previewSignIn(formData: FormData) {
  const id = normalizePreviewId(String(formData.get("loginId") ?? ""));
  const pw = String(formData.get("password") ?? "");
  const expectedId = normalizePreviewId(process.env.PREVIEW_LOGIN_ID ?? "");
  const expectedPw = process.env.PREVIEW_PASSWORD ?? "";
  const token = await previewToken();
  if (!token || !id || id !== expectedId || pw !== expectedPw) {
    await new Promise((r) => setTimeout(r, 1000)); // 総当たりを遅くする
    redirect("/preview?error=1");
  }
  cookies().set(PREVIEW_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/");
}
