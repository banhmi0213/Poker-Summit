"use client";
import { useState } from "react";
import { defaultStructure, type TournamentStructure, type BlindPeriod } from "@/lib/poker/tournament";
import NumberStepper from "./number-stepper";
import styles from "./structure-editor.module.css";
import layout from "./settings-layout.module.css";
import StructureView from "./structure-view";
export default function StructureEditor({ initial = defaultStructure }: {
    initial?: TournamentStructure;
}) {
    const [s, setS] = useState<TournamentStructure>({ ...initial, timeBankCards: initial.timeBankCards ?? 2 });
    const [minutes, setMinutes] = useState(20);
    const update = (i: number, patch: Partial<BlindPeriod>) => setS(prev => ({ ...prev, periods: prev.periods.map((p, j) => j === i ? { ...p, ...patch } : p) }));
    let level = 0;
    return <fieldset className={layout.panel}><legend>ブラインド・ストラクチャー設定</legend>
        <input type="hidden" name="structure" value={JSON.stringify(s)}/>
        <div className={layout.fields}>
            <label className={layout.field}>初期チップ<NumberStepper label="初期チップ" min={1} value={s.startingStack} onChange={startingStack => setS({ ...s, startingStack })}/></label>
            <label className={layout.field}>アンティ方式<select value={s.anteType} onChange={e => { const anteType = e.target.value as TournamentStructure["anteType"]; setS({ ...s, anteType, periods: s.periods.map(p => ({ ...p, ante: anteType === "none" ? 0 : p.ante })) }); }}><option value="none">なし</option><option value="bb">BBアンティ</option><option value="per-player">全員アンティ</option></select></label>
            <label className={layout.field}>レイトレジスト終了レベル（0＝開始時）<NumberStepper label="レイトレジスト終了レベル" increment={1} max={s.periods.filter(p => p.kind === "level").length} value={s.lateRegLevel} onChange={lateRegLevel => setS({ ...s, lateRegLevel })}/></label>
            <div className={layout.field}><span>リエントリー</span><label className={layout.checkbox}><input type="checkbox" checked={s.reentry} onChange={e => setS({ ...s, reentry: e.target.checked })}/>締切までリエントリー可</label></div>
            <label className={layout.field}>持ち時間<select value={s.turnSeconds ?? 20} onChange={e => setS({ ...s, turnSeconds: Number(e.target.value) as 20 | 30 })}><option value={20}>20秒</option><option value={30}>30秒</option></select></label>
            <label className={layout.field}>タイムバンクカード（開始時）<select value={s.timeBankCards ?? 2} onChange={e => setS({ ...s, timeBankCards: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}枚</option>)}</select></label>
            <div className={layout.field}><span>ファイナルテーブルでカード追加</span><label className={layout.checkbox}><input type="checkbox" checked={(s.finalTableCards ?? 0) > 0} onChange={e => setS({ ...s, finalTableCards: e.target.checked ? 1 : 0 })}/>追加する</label>{(s.finalTableCards ?? 0) > 0 && <select aria-label="ファイナルテーブルで追加する枚数" value={s.finalTableCards} onChange={e => setS({ ...s, finalTableCards: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}枚</option>)}</select>}</div>
        </div>
        <p className={layout.hint}>タイムバンクカードは1枚で持ち時間1回分（{s.turnSeconds ?? 20}秒）延ばせます。1ターンに1枚まで使えます。</p>
        <p className={layout.hint}>初期スタック：{(s.startingStack / (s.periods.find(p => p.kind === "level")?.bb || 1)).toFixed(1)} BB。推奨値は大会形式により異なり、固定制限は設けていません。</p>
        <div className={layout.bulk}>
            <div className={layout.group}><label className={layout.field}>レベル時間一括設定（分）<NumberStepper label="一括設定の分" min={1} max={240} increment={1} value={minutes} onChange={setMinutes}/></label><button type="button" className="btn" onClick={() => setS({ ...s, periods: s.periods.map(p => p.kind === "level" ? { ...p, minutes } : p) })}>レベルに適用</button></div>
            <div className={layout.group}><span className={layout.groupTitle}>アンティ一括設定</span><button type="button" className="btn" onClick={() => setS({ ...s, periods: s.periods.map(p => ({ ...p, ante: s.anteType === "none" || p.kind === "break" ? 0 : p.bb })) })}>アンティをBBと同額に設定</button></div>
        </div>
        <div style={{overflowX:"auto",maxWidth:"100%"}}><table className={styles.table}><thead><tr><th>LV／休憩</th><th>SB</th><th>BB</th><th>アンティ</th><th>分</th><th>備考・カラーアップ</th><th>操作</th></tr></thead><tbody>{s.periods.map((p, i) => <tr key={i}><td>{p.kind === "level" ? ++level : "休憩"}</td>{(["sb", "bb", "ante", "minutes"] as const).map(key => <td key={key} data-label={{sb:"SB",bb:"BB",ante:"アンティ",minutes:"分"}[key]}><NumberStepper label={`行${i + 1} ${key}`} min={key === "minutes" ? 1 : 0} max={key === "minutes" ? 240 : 1000000000} increment={key === "minutes" ? 1 : 10} disabled={key !== "minutes" && (p.kind === "break" || (key === "ante" && s.anteType === "none"))} value={p[key]} onChange={value => update(i, { [key]: value })}/></td>)}<td data-label="備考・カラーアップ"><input aria-label={`行${i + 1} 備考`} maxLength={200} value={p.note} onChange={e => update(i, { note: e.target.value })}/></td><td><button type="button" className="btn" disabled={s.periods.length === 1} onClick={() => setS({ ...s, periods: s.periods.filter((_, j) => j !== i) })}>削除</button>{p.kind === "level" && <button type="button" className="btn" disabled={s.periods.length >= 100} onClick={() => setS({ ...s, periods: [...s.periods.slice(0, i + 1), { kind: "break", sb: 0, bb: 0, ante: 0, minutes: 10, note: "" }, ...s.periods.slice(i + 1)] })}>後に休憩</button>}</td></tr>)}</tbody></table></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" className="btn" disabled={s.periods.length >= 100} onClick={() => { const last = [...s.periods].reverse().find(p => p.kind === "level")!; setS({ ...s, periods: [...s.periods, { ...last, minutes, note: "" }] }); }}>＋レベル</button><button type="button" className="btn" disabled={s.periods.length >= 100} onClick={() => setS({ ...s, periods: [...s.periods, { kind: "break", sb: 0, bb: 0, ante: 0, minutes: 10, note: "" }] })}>＋休憩</button><small>休憩の後にはレベルを追加してください。レベルごとの数値は自由に編集できます。</small></div><details><summary>ストラクチャー表示を確認</summary><StructureView structure={s}/></details></fieldset>;
}
