/** Shared configuration and wall-clock math. This is not a tournament game server. */
export type BlindPeriod = {
    kind: "level" | "break";
    minutes: number;
    sb: number;
    bb: number;
    ante: number;
    note: string;
};
export type TournamentStructure = {
    startingStack: number;
    anteType: "none" | "bb" | "per-player";
    lateRegLevel: number;
    reentry: boolean;
    periods: BlindPeriod[];
    /** Seconds per decision (20 or 30). Missing = 20. */
    turnSeconds?: 20 | 30;
    /** Time bank cards each player gets at the start (1-5); one card adds one turn's worth of time. Missing (older tournaments) = none. */
    timeBankCards?: number;
    /** Extra cards given when the final table forms (0 = none, up to 5). Missing = none. */
    finalTableCards?: number;
};
export const tournamentTiming = (s: Pick<TournamentStructure, "turnSeconds" | "timeBankCards" | "finalTableCards">) =>
    ({ turnSeconds: s.turnSeconds ?? 20, timeBankCards: s.timeBankCards ?? 0, finalTableCards: s.finalTableCards ?? 0 });
export type TournamentPrize = { rank: number; kind: "chips" | "text"; chips: number; description: string };
export function validateTournamentDetails(organizer: unknown, raw: unknown) {
    if (typeof organizer !== "string" || organizer.trim().length > 200) throw new Error("主催者名は200文字以内で入力してください。");
    if (!Array.isArray(raw) || raw.length > 100) throw new Error("プライズは100件以内で設定してください。");
    const ranks = new Set<number>();
    const prizes: TournamentPrize[] = raw.map(p => {
        if (!p || !Number.isSafeInteger(p.rank) || p.rank < 1 || p.rank > 1000 || ranks.has(p.rank)) throw new Error("プライズの順位は1〜1000の重複しない整数で設定してください。");
        ranks.add(p.rank);
        if (p.kind !== "chips" && p.kind !== "text") throw new Error("プライズの種類を確認してください。");
        if (typeof p.description !== "string" || p.description.trim().length > 500) throw new Error("プライズの説明は500文字以内で入力してください。");
        if (p.kind === "chips" && (!Number.isSafeInteger(p.chips) || p.chips < 1 || p.chips > 1000000000)) throw new Error("プライズのチップ数は1〜1,000,000,000で入力してください。");
        if (p.kind === "text" && !p.description.trim()) throw new Error("プライズの内容を入力してください。");
        return {rank:p.rank, kind:p.kind, chips:p.kind === "chips" ? p.chips : 0, description:p.description.trim()};
    });
    return {organizer_name:organizer.trim(), prizes:prizes.sort((a,b)=>a.rank-b.rank)};
}
export type PokerTournament = {
    organizer_name?: string;
    prizes?: TournamentPrize[];
    id: string;
    title: string;
    owner_store_id: string | null;
    starts_at: string;
    published: boolean;
    structure: TournamentStructure;
    image_url: string | null;
    image_path?: string | null;
};
const int = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
export function validateStructure(raw: unknown): TournamentStructure {
    if (!raw || typeof raw !== "object")
        throw new Error("ストラクチャーを確認してください。");
    const s = raw as TournamentStructure;
    if (!int(s.startingStack, 1, 1000000000) || !["none", "bb", "per-player"].includes(s.anteType) || typeof s.reentry !== "boolean" || !Array.isArray(s.periods) || !s.periods.length || s.periods.length > 100)
        throw new Error("初期チップ・アンティ方式・レベル数を確認してください。");
    const periods = s.periods.map((p): BlindPeriod => {
        if (!p || !["level", "break"].includes(p.kind) || !int(p.minutes, 1, 240) || typeof p.note !== "string" || p.note.length > 200)
            throw new Error("各レベルの時間・備考を確認してください。");
        if (p.kind === "break")
            return { kind: "break", minutes: p.minutes, sb: 0, bb: 0, ante: 0, note: p.note.trim() };
        if (!int(p.sb, 1, 1000000000) || !int(p.bb, p.sb, 1000000000) || !int(p.ante, 0, 1000000000) || (s.anteType === "none" && p.ante !== 0))
            throw new Error("SB・BB・アンティを確認してください。");
        return { ...p, note: p.note.trim() };
    });
    const levels = periods.filter(p => p.kind === "level");
    if (!levels.length || periods[0].kind !== "level" || periods[periods.length - 1].kind !== "level" || !int(s.lateRegLevel, 0, levels.length))
        throw new Error("最初と最後はレベルを設定し、レイトレジスト締切を確認してください。");
    for (let i = 1; i < levels.length; i++)
        if (levels[i].sb < levels[i - 1].sb || levels[i].bb < levels[i - 1].bb)
            throw new Error("ブラインドは前のレベル以上にしてください。");
    if ((s.turnSeconds !== undefined && s.turnSeconds !== 20 && s.turnSeconds !== 30) || (s.timeBankCards !== undefined && !int(s.timeBankCards, 1, 5)) || (s.finalTableCards !== undefined && !int(s.finalTableCards, 0, 5)))
        throw new Error("持ち時間（20秒か30秒）・タイムバンクカード（1〜5枚）・ファイナルテーブルの追加（0〜5枚）を確認してください。");
    return { startingStack: s.startingStack, anteType: s.anteType, lateRegLevel: s.lateRegLevel, reentry: s.reentry, periods,
        ...(s.turnSeconds !== undefined ? { turnSeconds: s.turnSeconds } : {}), ...(s.timeBankCards !== undefined ? { timeBankCards: s.timeBankCards } : {}), ...(s.finalTableCards !== undefined ? { finalTableCards: s.finalTableCards } : {}) };
}
export const defaultStructure: TournamentStructure = {
    startingStack: 10000, anteType: "bb", lateRegLevel: 4, reentry: false,
    periods: [
        ...[[50, 100, 0], [75, 150, 0], [100, 200, 200], [150, 300, 300]].map(([sb, bb, ante]) => ({ kind: "level" as const, minutes: 20, sb, bb, ante, note: "" })),
        { kind: "break", minutes: 10, sb: 0, bb: 0, ante: 0, note: "25点チップのカラーアップ" },
        ...[[200, 400, 400], [300, 600, 600], [400, 800, 800], [600, 1200, 1200]].map(([sb, bb, ante]) => ({ kind: "level" as const, minutes: 20, sb, bb, ante, note: "" })),
    ],
};
export function lateRegistrationEndsAt(s: TournamentStructure, startsAt: string): number {
    const start = Date.parse(startsAt);
    if (!Number.isFinite(start))
        throw new Error("開始日時を確認してください。");
    let end = start, level = 0;
    for (const p of s.periods) {
        if (level >= s.lateRegLevel)
            break;
        end += p.minutes * 60000;
        if (p.kind === "level")
            level++;
    }
    return end;
}
export function tournamentClock(s: TournamentStructure, startsAt: string, now: number) {
    const start = Date.parse(startsAt);
    if (!Number.isFinite(start) || !Number.isFinite(now))
        throw new Error("タイマーの日時を確認してください。");
    const first = s.periods.find(p => p.kind === "level")!;
    if (now < start)
        return { phase: "scheduled" as const, index: 0, level: 1, period: first, next: first, remaining: Math.ceil((start - now) / 1000), registrationOpen: true };
    let end = start, level = 0;
    for (let i = 0; i < s.periods.length; i++) {
        const p = s.periods[i];
        end += p.minutes * 60000;
        if (p.kind === "level")
            level++;
        if (now < end)
            return { phase: p.kind, index: i, level, period: p, next: s.periods.slice(i + 1).find(p => p.kind === "level") ?? null, remaining: Math.ceil((end - now) / 1000), registrationOpen: now < lateRegistrationEndsAt(s, startsAt) };
    }
    // A tournament does not end just because its configured final level expires.
    return { phase: "final" as const, index: s.periods.length - 1, level, period: s.periods[s.periods.length - 1], next: null, remaining: 0, registrationOpen: false };
}
export function clockText(seconds: number): string { const n = Math.max(0, Math.floor(seconds)); return `${Math.floor(n / 60).toString().padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`; }
