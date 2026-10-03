import { MyPageContent } from "@/app/mypage/dashboard";

export default function ProfilePage({ searchParams }: {
  searchParams: { error?: string; done?: string; tab?: string };
}) {
  return <MyPageContent searchParams={searchParams} profileEdit />;
}
