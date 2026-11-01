import type { Metadata } from "next";
import { staticPageMetadata } from "@/lib/seo";
import { RegistrationPage } from "./registration";
export const metadata: Metadata = staticPageMetadata({ title: "会員登録", description: "Poker Summitの無料会員登録。お気に入り店舗の保存、求人応募、クーポン利用などをご利用いただけます。", path: "/signup" });
export default function SignupPage({searchParams}: {searchParams: {error?: string; done?: string; next?: string; src?: string}}) {
  return RegistrationPage({searchParams});
}
