// Supabase(PostgREST)は1回の問い合わせで最大1,000行しか返さない。
// 閲覧数などを行で取って数える集計で、1,000件を超えると数字が1,000で頭打ちになっていた
// (2026/10、総合管理の「期間内PV」が1,000のまま止まっていた)。
// id 順に1,000行ずつ区切って最後まで取り切る。build は毎回新しいクエリを返すこと。
export async function fetchAllRows<T = any>(
  build: () => any,
  opts: { pageSize?: number; maxRows?: number } = {}
): Promise<{ data: T[]; error: any }> {
  const pageSize = opts.pageSize ?? 1000;
  const maxRows = opts.maxRows ?? 500_000;
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build().order("id", { ascending: true }).range(from, from + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return { data: rows, error: null };
}
