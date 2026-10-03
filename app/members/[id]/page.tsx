import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalHeader } from "@/app/portal-header";
import { PortalFooter } from "@/app/portal-footer";
import { BottomTabs } from "@/app/bottom-tabs";
import { Avatar } from "@/app/avatar";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP");
}

const POSTS_LIMIT = 20;

// 会員の公開プロフィールページ(2026/10、「サミットからアイコン押したら
// プロフィールが見れるように」との指示)。board/page.tsx・board/[id]/page.tsx
// のアイコンからここへリンクする。profilesテーブルは全員に公開読み取り
// 許可されている(RLS「profiles are publicly readable」)ため、未ログインの
// 訪問者にも見せて問題ない(サミットの投稿詳細自体は会員登録が必要だが、
// 一覧・アイコンは未ログインでも見えるのと同じ扱い)。
export default async function MemberProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [{ data: { user } }, { data: profile }, { data: posts }, { data: replies }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, role, bio, pref, pref_public, email_public, public_email")
      .eq("user_id", params.id)
      .maybeSingle(),
    supabase
      .from("board_posts")
      .select("id, title, created_at, category, author_name")
      .eq("author_user_id", params.id)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(POSTS_LIMIT),
    // 返信だけしかしていない会員の存在確認用(2026/10、「アイコン押したら
    // これ(404)」との報告を受けて追加)。投稿が1件もなくてもコメント
    // (board_replies)だけで参加している会員はいるので、投稿だけを見て
    // いると本人が実在するのに404になってしまっていた。
    supabase
      .from("board_replies")
      .select("author_name")
      .eq("author_user_id", params.id)
      .eq("status", "visible")
      .limit(1),
  ]);

  // profilesに行がなく、投稿・返信も1件もない場合は、このuser_idが実在する
  // 会員かどうかそもそも確認できないため404にする(auth.usersはサーバー側
  // からも直接は引けない。/account/profileを一度も保存していない会員は
  // profiles行が無いので、投稿か返信さえあれば存在確認として扱う)。
  if (!profile && (!posts || posts.length === 0) && (!replies || replies.length === 0)) {
    notFound();
  }

  // 表示名はprofiles.display_name(/account/profile保存時にミラーされる)を
  // 優先し、未設定なら本人の投稿・返信に残っているauthor_nameにフォールバックする。
  const fallbackName =
    (posts?.find((p: any) => p.author_name)?.author_name as string | undefined) ||
    (replies?.find((r: any) => r.author_name)?.author_name as string | undefined);
  const displayName = profile?.display_name || fallbackName || "名無しの会員";

  return (
    <div>
      <PortalHeader userEmail={user?.email} />
      <div className="container" style={{ maxWidth: 640, paddingTop: 20 }}>
        <Link href="/board" className="breadcrumb">
          ← サミットに戻る
        </Link>

        <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar name={displayName} url={profile?.avatar_url ?? null} size={72} />
          <div style={{ flex: 1, minWidth: 180 }}>
            {profile?.role && (
              <div
                className="badge outline"
                style={{ display: "inline-block", marginBottom: 6, color: "var(--accent)", borderColor: "var(--accent)" }}
              >
                {profile.role}
              </div>
            )}
            <div style={{ fontWeight: 800, fontSize: 20 }}>{displayName}</div>
            {/* 都道府県(2026/10追加)。本人がpref_publicをfalseにしていたら
                他の会員には出さない(「会員登録時都道府県を非公開にできる
                ように」との指示)。 */}
            {profile?.pref_public !== false && profile?.pref && (
              <div className="muted small">📍 {profile.pref}</div>
            )}
            {profile?.email_public === true && profile.public_email && <div className="muted small" style={{ marginTop: 6, overflowWrap: "anywhere" }}>✉ <a href={`mailto:${profile.public_email}`}>{profile.public_email}</a></div>}
          </div>
        </div>

        {profile?.bio && (
          <div className="card" style={{ marginTop: 14 }}>
            <h2 style={{ fontSize: 14, marginBottom: 8 }}>ひとこと</h2>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0 }}>{profile.bio}</p>
          </div>
        )}

        <h2 style={{ fontSize: 16, marginTop: 20, marginBottom: 10 }}>
          サミットへの投稿 ({posts?.length ?? 0})
        </h2>
        {(!posts || posts.length === 0) && (
          <p className="muted small">まだ投稿がありません。</p>
        )}
        {posts?.map((p: any) => (
          <Link href={`/board/${p.id}`} key={p.id} style={{ display: "block" }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</div>
              <div className="meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                {p.category && <span className="badge outline">{p.category}</span>}
                <span className="muted" style={{ color: "var(--text-2)" }}>{formatDate(p.created_at)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <PortalFooter />
      <BottomTabs active="board" />
    </div>
  );
}
