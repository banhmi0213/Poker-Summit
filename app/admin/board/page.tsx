import { createClient } from "@/lib/supabase/server";
import { setPostStatus, setReplyStatus, resolveReport } from "./actions";

export default async function AdminBoardPage() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("board_reports")
    .select("*, board_posts(id, title), board_replies(id, body, post_id)")
    .eq("status", "open")
    .order("created_at", { ascending: false });

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

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>
        未対応の通報 ({reports?.length ?? 0})
      </h2>
      {(!reports || reports.length === 0) && (
        <p className="muted">未対応の通報はありません。</p>
      )}
      {reports?.map((r: any) => (
        <div className="card" key={r.id}>
          <div className="muted">{r.reason}</div>
          {r.board_posts ? (
            <p>投稿：{r.board_posts.title}</p>
          ) : r.board_replies ? (
            <p>返信：{r.board_replies.body}</p>
          ) : null}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {r.board_posts && (
              <form
                action={async () => {
                  "use server";
                  await setPostStatus(r.board_posts.id, "hidden");
                }}
              >
                <button type="submit" className="btn">
                  投稿を非公開にする
                </button>
              </form>
            )}
            {r.board_replies && (
              <form
                action={async () => {
                  "use server";
                  await setReplyStatus(r.board_replies.id, "hidden");
                }}
              >
                <button type="submit" className="btn">
                  返信を非公開にする
                </button>
              </form>
            )}
            <form
              action={async () => {
                "use server";
                await resolveReport(r.id);
              }}
            >
              <button type="submit" className="btn primary">
                対応済みにする
              </button>
            </form>
          </div>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 28, marginBottom: 10 }}>
        非公開の投稿 ({hiddenPosts?.length ?? 0})
      </h2>
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
