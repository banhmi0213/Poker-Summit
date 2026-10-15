import { type TournamentStructure } from "@/lib/poker/tournament";
export default function StructureView({ structure: s, currentIndex }: {
    structure: TournamentStructure;
    currentIndex?: number;
}) {
    let level = 0;
    return <div><p>初期チップ <b>{s.startingStack.toLocaleString()}</b> ／ アンティ {s.anteType === "bb" ? "BBアンティ" : s.anteType === "per-player" ? "全員アンティ" : "なし"}</p><p>レイトレジスト：{s.lateRegLevel ? `レベル${s.lateRegLevel}終了まで` : "開始時に締切"} ／ リエントリー：{s.reentry ? "レイトレジスト締切まで可" : "不可"}</p><div className="table-wrap"><table style={{ width: "100%", fontVariantNumeric: "tabular-nums" }}><thead><tr><th>LV</th><th>SB / BB</th><th>アンティ</th><th>時間</th><th>休憩・カラーアップ等</th></tr></thead><tbody>{s.periods.map((p, i) => <tr key={i} aria-current={i === currentIndex ? "step" : undefined} style={i === currentIndex ? { background: "#bd97472b" } : undefined}><td>{p.kind === "level" ? ++level : "休憩"}</td><td>{p.kind === "level" ? `${p.sb.toLocaleString()} / ${p.bb.toLocaleString()}` : "—"}</td><td>{p.kind === "level" ? p.ante.toLocaleString() : "—"}</td><td>{p.minutes}分</td><td>{p.note}</td></tr>)}</tbody></table></div><small>最終レベル以降は同じブラインドを継続します。カラーアップは予定の表示です。</small></div>;
}
