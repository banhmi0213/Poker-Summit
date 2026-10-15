import type { PokerTournament } from "@/lib/poker/tournament";
export default function PrizeView({tournament:t}:{tournament:Pick<PokerTournament,"organizer_name"|"prizes">}) {
 return <>{t.organizer_name && <p>主催：{t.organizer_name}</p>}{Boolean(t.prizes?.length) && <section aria-label="プライズ"><h3>プライズ</h3><ul>{t.prizes!.map(p=><li key={p.rank}>{p.rank}位：{p.kind==="chips"?`${p.chips.toLocaleString()} チップ${p.description?` ／ ${p.description}`:""}`:p.description}</li>)}</ul><small>チップの自動付与は準備中です。</small></section>}</>;
}
