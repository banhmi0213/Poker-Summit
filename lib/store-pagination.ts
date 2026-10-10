export const STORES_PER_PAGE = 12;

export function paginateStores<T>(stores: T[], requestedPage?: string) {
  const parsed = Number(requestedPage);
  const totalPages = Math.ceil(stores.length / STORES_PER_PAGE);
  const page = Math.min(Math.max(1, Number.isSafeInteger(parsed) ? parsed : 1), Math.max(1, totalPages));
  return { page, totalPages, items: stores.slice((page - 1) * STORES_PER_PAGE, page * STORES_PER_PAGE) };
}

export function storePageHref(filters: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const key of ["q", "category", "pref", "city", "region", "area", "lat", "lng"]) {
    if (filters[key]) params.set(key, filters[key]!);
  }
  if (page > 1) params.set("page", String(page));
  return `/stores${params.size ? `?${params}` : ""}`;
}
