export type SpotShift = { work_date: string; start_time: string; end_time: string; break_minutes: number; hourly_wage: number; headcount: number };
export type SpotJob = { contract_type?: 'employment'|'contract'|null; payment_method?: 'bank'|'cash'|null; payment_date?: string|null; contract_notes?: string|null; id: string; store_id: string; games: string[]; duties: string; requirements: string; transport_type: string; transport_limit: number | null; dress: string; deadline: string; image_path: string | null; published: boolean; spot_job_shifts: SpotShift[]; stores?: { id: string; name: string; pref: string; city: string; address: string; banner_url: string | null } };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const japanToday = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value; }
export function validTime(value: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
export function minutes(value: string) { const [h,m] = value.split(':').map(Number); return h*60+m; }
export function validateShifts(shifts: SpotShift[]) {
  if (!Array.isArray(shifts) || shifts.length < 1 || shifts.length > 90) throw new Error('勤務日を1〜90日選択してください。');
  const dates = new Set<string>();
  for (const s of shifts) {
    if (!s || !validDate(s.work_date) || dates.has(s.work_date)) throw new Error('勤務日の形式・重複を確認してください。');
    dates.add(s.work_date);
    if (!validTime(s.start_time) || !validTime(s.end_time) || s.start_time === s.end_time) throw new Error('開始・終了時間を入力してください。同じ時間は指定できません。');
    const duration = (minutes(s.end_time)-minutes(s.start_time)+1440)%1440;
    if (!Number.isInteger(s.break_minutes) || s.break_minutes < 0 || s.break_minutes >= duration) throw new Error('休憩時間は勤務時間より短くしてください。');
    if (!Number.isInteger(s.hourly_wage) || s.hourly_wage < 1 || s.hourly_wage > 100000) throw new Error('時給を1〜100,000円で入力してください。');
    if (!Number.isInteger(s.headcount) || s.headcount < 1 || s.headcount > 1000) throw new Error('募集人数を1〜1,000人で入力してください。');
  }
}
export const shiftTime = (s: SpotShift) => `${s.start_time.slice(0,5)}〜${s.end_time < s.start_time ? '翌日 ' : ''}${s.end_time.slice(0,5)}`;
export const transportText = (j: SpotJob) => j.transport_type === 'full' ? '全額支給' : j.transport_type === 'limited' ? `支給あり（上限 ${Number(j.transport_limit).toLocaleString()}円）` : '支給なし';
