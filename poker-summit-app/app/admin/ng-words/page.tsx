import { createClient } from "@/lib/supabase/server";
import { addNgWord, deleteNgWord } from "./actions";

export default async function AdminNgWordsPage() {
  const supabase = await createClient();
  const { data: words } = await supabase
    .from("ng_words")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>NGワード管理</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        登録した単語を含む掲示板の投稿・返信は、自動的に非公開として扱われます。
      </p>

      <div className="card" style={{ maxWidth: 420 }}>
        <form action={addNgWord} style={{ display: "flex", gap: 8 }}>
          <input type="text" name="word" placeholder="NGワードを入力" required style={{ flex: 1 }} />
          <button type="submit" className="btn primary">
            追加
          </button>
        </form>
      </div>

      <table style={{ maxWidth: 420 }}>
        <thead>
          <tr>
            <th>ワード</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {words?.map((w) => (
            <tr key={w.id}>
              <td>{w.word}</td>
              <td>
                <form
                  action={async () => {
                    "use server";
                    await deleteNgWord(w.id);
                  }}
                >
                  <button type="submit" className="btn">
                    削除
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
