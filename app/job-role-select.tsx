import { JOB_ROLES } from "@/lib/job-categories";
export function JobRoleSelect({ value = "" }: { value?: string }) {
  return <label className="field"><span>職種（カテゴリへの自動振り分け）</span>
    <select name="jobRole" defaultValue={value}><option value="">未設定</option>{JOB_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
    <small>ディーラー・ホールスタッフは選んだ職種の一覧へ掲載。雇用形態が「正社員」の求人は正社員の一覧にも掲載されます。単発のディーラー募集は「スポット求人管理」から登録すると「スポット」に自動掲載されます。公開中の求人のみ表示されます。</small>
  </label>;
}
