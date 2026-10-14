export const JOB_ROLES = ["ディーラー", "ホールスタッフ", "バーテンダー", "店舗運営・その他"] as const;
export const JOB_ENTRANCES = [
  { label: "ディーラー", path: "/jobs", role: "ディーラー", x: 17, y: 405 },
  { label: "スポットディーラー", path: "/spot-jobs", x: 777, y: 405 },
  { label: "ホールスタッフ", path: "/jobs", role: "ホールスタッフ", x: 17, y: 705 },
  { label: "正社員", path: "/jobs", jobType: "正社員", x: 777, y: 705 },
] as const;

export function jobEntranceHref(entry: typeof JOB_ENTRANCES[number], pref = "") {
  const params = new URLSearchParams();
  if ("role" in entry) params.set("role", entry.role);
  if ("jobType" in entry) params.set("jobType", entry.jobType);
  if (pref) params.set("pref", pref);
  if (entry.path === "/spot-jobs") params.set("sort", "new");
  return entry.path + (params.size ? `?${params}` : "");
}
export function readJobRole(value: FormDataEntryValue | null) {
  const role = String(value ?? "").trim();
  if (role && !JOB_ROLES.some(r => r === role)) throw new Error("職種を選択し直してください。");
  return role || null;
}
export function matchesJobRole(job: { job_role?: string | null; title?: string | null }, role: string) {
  if (!role) return true;
  if (job.job_role) return job.job_role === role;
  // Existing unclassified listings remain discoverable by their explicit role in the title.
  if (role === "ディーラー") return /ディーラー|dealer/i.test(job.title ?? "");
  if (role === "ホールスタッフ") return /ホールスタッフ|フロアスタッフ/.test(job.title ?? "");
  return false;
}

export const JOB_FILTERS = ["ディーラー", "スポット", "ホールスタッフ", "正社員"] as const;
export function readJobFilters(value?: string | string[]) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return JOB_FILTERS.filter(category => values.includes(category));
}
export function matchesJobFilters(job: { job_role?: string | null; title?: string | null; job_type?: string | null }, filters: readonly string[]) {
  return !filters.length || filters.some(category => category === "正社員" ? job.job_type === "正社員" : category !== "スポット" && matchesJobRole(job, category));
}
