import { MyPageContent } from "./dashboard";

export default function MyPage({ searchParams }: { searchParams: { tab?: string; boardPage?: string } }) {
  return <MyPageContent searchParams={searchParams} />;
}
