import { JOB_ROLES } from "@/lib/job-categories";
export function JobRoleSelect({ value = "" }: { value?: string }) {
  return <label className="field"><span>職種（カテゴリへの自動振り分け）</span>
    <select name="jobRole" defaultValue={value}><option value="">未設定</option>{JOB_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
    <small>職種と雇用形態をそれぞれ選択してください。求人一覧では両方の条件に合う募集に表示されます（例：ディーラー × 正社員）。単発のディーラー募集は「スポット求人管理」から登録すると「スポット」に自動掲載されます。公開中の求人のみ表示されます。</small>
  </label>;
}
