import { createClient } from "@/lib/supabase/server";
import { createBanner, toggleBannerActive } from "./actions";

const POSITION_LABEL: Record<string, string> = {
  top: "トップ",
  sidebar: "サイドバー",
  footer: "フッター",
};

export default async function AdminBannersPage() {
  const supabase = await createClient();
  const { data: banners } = await supabase
    .from("banners")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>バナー管理</h1>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>新規バナー追加</h2>
        <form action={createBanner}>
          <div className="field">
            <span className="muted">バナー名 *</span>
            <input type="text" name="title" required />
          </div>
          <div className="field">
            <span className="muted">画像URL</span>
            <input type="text" name="imageUrl" placeholder="https://..." />
          </div>
          <div className="field">
            <span className="muted">リンク先URL</span>
            <input type="text" name="linkUrl" placeholder="https://..." />
          </div>
          <div className="field">
            <span className="muted">表示位置</span>
            <select name="position" defaultValue="top">
              <option value="top">トップ</option>
              <option value="sidebar">サイドバー</option>
              <option value="footer">フッター</option>
            </select>
          </div>
          <div className="field">
            <span className="muted">表示順（小さいほど先）</span>
            <input type="number" name="sortOrder" defaultValue={0} />
          </div>
          <button type="submit" className="btn primary">
            追加する
          </button>
        </form>
      </div>

      <table>
        <thead>
          <tr>
            <th>バナー名</th>
            <th>位置</th>
            <th>順序</th>
            <th>状態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {banners?.map((b) => (
            <tr key={b.id}>
              <td>{b.title}</td>
              <td>{POSITION_LABEL[b.position] ?? b.position}</td>
              <td>{b.sort_order}</td>
              <td>
                <span className="badge">{b.active ? "公開中" : "停止中"}</span>
              </td>
              <td>
                <form
                  action={async () => {
                    "use server";
                    await toggleBannerActive(b.id, !b.active);
                  }}
                >
                  <button type="submit" className="btn">
                    {b.active ? "停止する" : "公開する"}
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
