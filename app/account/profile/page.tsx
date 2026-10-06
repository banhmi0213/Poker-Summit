import { MyPageContent } from "@/app/mypage/dashboard";

export default function ProfilePage({ searchParams }: {
  searchParams: { error?: string; done?: string; tab?: string; dealer?: string };
}) {
  return <MyPageContent searchParams={searchParams} profileEdit dealerRegistration={searchParams.dealer === "1"} />;
}
