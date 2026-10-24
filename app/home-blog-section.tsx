import Link from "next/link";
import { getHomeBlogEntries } from "@/lib/home-blog";
import { HomeBlogSlider } from "./home-blog-slider";

export async function HomeBlogSection() {
 try {
  const entries=await getHomeBlogEntries();
  return entries.length ? <HomeBlogSlider entries={entries}/> : null;
 } catch {
  return <section className="home-section"><div className="home-section-head"><h2>新着ブログ</h2><Link href="/blog">ブログ一覧を見る</Link></div><p>記事はブログ一覧からご確認ください。</p></section>;
 }
}
