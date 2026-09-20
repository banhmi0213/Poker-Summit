import { createClient } from "@/lib/supabase/server";
import { setPostStatus, setReplyStatus } from "./actions";

export default async function AdminBoardPage() {
  const supabase = await createClient();

  const { data: hiddenPosts } = await supabase
    .from("board_posts")
    .select("id, title, author_name, created_at")
    .eq("status", "hidden")
    .order("created_at", { ascending: false });

  const { data: hiddenReplies } = await supabase
    .from("board_replies")
    .select("id, body, author_name, post_id, created_at")
    .eq("status", "hidden")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>掲示板管理</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        通報の対応は「通報管理」ページで行います。ここでは非公開にした投稿・返信を管理します。
      </p>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>
        非公開の投稿 ({hiddenPosts?.length ?? 0})
      </h2>
      {(!hiddenPosts || hiddenPosts.length === 0) && (
        <p className="muted">非公開の投稿はありません。</p>
      )}
      {hiddenPosts?.map((p) => (
        <div className="card" key={p.id}>
          <h3>{p.title}</h3>
          <div className="muted">{p.author_name}</div>
          <form
            action={async () => {
              "use server";
              await setPostStatus(p.id, "visible");
            }}
            style={{ marginTop: 8 }}
          >
            <button type="submit" className="btn">
              公開に戻す
            </button>
          </form>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 28, marginBottom: 10 }}>
        非公開の返信 ({hiddenReplies?.length ?? 0})
      </h2>
      {(!hiddenReplies || hiddenReplies.length === 0) && (
        <p className="muted">非公開の返信はありません。</p>
      )}
      {hiddenReplies?.map((r) => (
        <div className="card" key={r.id}>
          <p>{r.body}</p>
          <div className="muted">{r.author_name}</div>
          <form
            action={async () => {
              "use server";
              await setReplyStatus(r.id, "visible");
            }}
            style={{ marginTop: 8 }}
          >
            <button type="submit" className="btn">
              公開に戻す
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
