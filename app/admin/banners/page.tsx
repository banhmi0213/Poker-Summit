import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BANNER_POSITIONS, BANNER_POSITION_LABEL } from "@/lib/banners";
import { deleteBanner, moveBanner, toggleBannerActive, updateBannerSortOrder } from "./actions";
import { BannerForm, DeleteBannerButton, type EditableBanner } from "./banner-form";
import styles from "./banners.module.css";

type BannerRow = {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  scope: string | null;
  sort_order: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// ISO文字列 → <input type="datetime-local"> 用の日本時間 "YYYY-MM-DDTHH:mm"
function toJstInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 16);
}

function formatJst(iso: string | null): string {
  return toJstInput(iso).replace("T", " ").replace(/-/g, "/");
}

function periodLabel(b: BannerRow): string {
  if (!b.starts_at && !b.ends_at) return "常時";
  return `${b.starts_at ? formatJst(b.starts_at) : ""}〜${b.ends_at ? formatJst(b.ends_at) : ""}`;
}

function periodStatus(b: BannerRow, now: number): string | null {
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return "掲載前";
  if (b.ends_at && new Date(b.ends_at).getTime() < now) return "掲載終了";
  return null;
}

const POSITION_ORDER: Record<string, number> = Object.fromEntries(BANNER_POSITIONS.map((p, i) => [p.value, i]));

export default async function AdminBannersPage({
  searchParams,
}: {
  searchParams: { position?: string; edit?: string };
}) {
  const supabase = await createClient();
  const positionFilter = BANNER_POSITIONS.some((p) => p.value === searchParams.position)
    ? searchParams.position!
    : "";

  const { data } = await supabase
    .from("banners")
    .select("id, title, image_url, link_url, position, scope, sort_order, active, starts_at, ends_at, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const allBanners = ((data ?? []) as BannerRow[]).sort(
    (a, b) => (POSITION_ORDER[a.position] ?? 99) - (POSITION_ORDER[b.position] ?? 99)
  );
  const banners = positionFilter ? allBanners.filter((b) => b.position === positionFilter) : allBanners;

  const editing = searchParams.edit ? allBanners.find((b) => b.id === searchParams.edit) : undefined;
  const editable: EditableBanner | undefined = editing && {
    id: editing.id,
    title: editing.title,
    image_url: editing.image_url,
    link_url: editing.link_url,
    position: editing.position,
    scope: editing.scope,
    sort_order: editing.sort_order,
    active: editing.active,
    startsAtLocal: toJstInput(editing.starts_at),
    endsAtLocal: toJstInput(editing.ends_at),
  };

  // 上下ボタンは同じ表示位置の中での前後を入れ替える。
  const groupIndex = new Map<string, { index: number; size: number }>();
  for (const p of BANNER_POSITIONS) {
    const group = allBanners.filter((b) => b.position === p.value);
    group.forEach((b, index) => groupIndex.set(b.id, { index, size: group.length }));
  }

  const now = Date.now();
  const filterHref = (value: string) => (value ? `/admin/banners?position=${value}` : "/admin/banners");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>バナー管理</h1>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 10 }}>{editable ? "バナーを編集" : "新規バナー追加"}</h2>
        {searchParams.edit && !editable && <p className="err">編集するバナーが見つかりません。</p>}
        <BannerForm key={editable?.id ?? "new"} banner={editable} />
      </div>

      <nav className={styles.filters} aria-label="表示位置で絞り込み">
        <Link href={filterHref("")} className={`btn ${styles.small} ${!positionFilter ? styles.filterActive : ""}`}>
          すべて（{allBanners.length}）
        </Link>
        {BANNER_POSITIONS.map((p) => {
          const n = allBanners.filter((b) => b.position === p.value).length;
          return (
            <Link
              key={p.value}
              href={filterHref(p.value)}
              className={`btn ${styles.small} ${positionFilter === p.value ? styles.filterActive : ""}`}
            >
              {p.label}（{n}）
            </Link>
          );
        })}
      </nav>

      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>画像</th>
              <th>バナー名</th>
              <th>表示位置</th>
              <th>絞り込み範囲</th>
              <th>リンク先</th>
              <th>掲載期間</th>
              <th>表示順</th>
              <th>表示</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {banners.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  バナーはまだありません。
                </td>
              </tr>
            )}
            {banners.map((b) => {
              const g = groupIndex.get(b.id) ?? { index: 0, size: 1 };
              const status = periodStatus(b, now);
              return (
                <tr key={b.id}>
                  <td>
                    {b.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.image_url} alt={b.title} className={styles.thumb} loading="lazy" />
                    ) : (
                      <span className={styles.noImage}>画像なし</span>
                    )}
                  </td>
                  <td>{b.title}</td>
                  <td>{BANNER_POSITION_LABEL[b.position] ?? b.position}</td>
                  <td>{b.scope || "—"}</td>
                  <td>
                    {b.link_url ? (
                      <a href={b.link_url} target="_blank" rel="noopener noreferrer" className={styles.link} title={b.link_url}>
                        {b.link_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {periodLabel(b)}
                    {status && (
                      <>
                        <br />
                        <span className="badge">{status}</span>
                      </>
                    )}
                  </td>
                  <td>
                    <div className={styles.inline}>
                      <form action={updateBannerSortOrder.bind(null, b.id)} className={styles.inline}>
                        <input
                          type="number"
                          name="sortOrder"
                          step={1}
                          defaultValue={b.sort_order}
                          className={styles.sortInput}
                          aria-label={`${b.title}の表示順`}
                        />
                        <button type="submit" className={`btn ${styles.small}`}>
                          保存
                        </button>
                      </form>
                      <form action={moveBanner.bind(null, b.id, "up")}>
                        <button
                          type="submit"
                          className={`btn ${styles.small}`}
                          disabled={g.index === 0}
                          aria-label={`${b.title}を上へ`}
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveBanner.bind(null, b.id, "down")}>
                        <button
                          type="submit"
                          className={`btn ${styles.small}`}
                          disabled={g.index >= g.size - 1}
                          aria-label={`${b.title}を下へ`}
                        >
                          ↓
                        </button>
                      </form>
                    </div>
                  </td>
                  <td>
                    <form action={toggleBannerActive.bind(null, b.id, !b.active)}>
                      <button type="submit" className={`btn ${styles.small}`} aria-pressed={b.active}>
                        {b.active ? "ON（公開中）" : "OFF（停止中）"}
                      </button>
                    </form>
                  </td>
                  <td>
                    <div className={styles.inline}>
                      <Link
                        href={`/admin/banners?${new URLSearchParams({
                          ...(positionFilter ? { position: positionFilter } : {}),
                          edit: b.id,
                        }).toString()}`}
                        className={`btn ${styles.small}`}
                      >
                        編集
                      </Link>
                      <DeleteBannerButton action={deleteBanner.bind(null, b.id)} title={b.title} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
