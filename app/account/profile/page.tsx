import { redirect } from "next/navigation";
import { MyPageContent } from "@/app/mypage/dashboard";

export default function ProfilePage({ searchParams }: {
  searchParams: { error?: string; done?: string; tab?: string; dealer?: string };
}) {
  if (searchParams.dealer === "1") redirect("/account/dealer");
  return <MyPageContent searchParams={searchParams} profileEdit dealerRegistration={searchParams.dealer === "1"} />;
}
