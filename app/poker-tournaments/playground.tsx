"use client";
import { useState } from "react";
import { defaultStructure, validateStructure, type PokerTournament } from "@/lib/poker/tournament";
import StructureEditor from "./structure-editor";
import TournamentPanel from "./clock-panel";
export default function Playground({ serverNow }: {
    serverNow: number;
}) {
    const [tournament, setTournament] = useState<PokerTournament>({ id: "sample", title: "ストラクチャー入力プレビュー", owner_store_id: null, starts_at: new Date(serverNow).toISOString(), published: false, structure: defaultStructure, image_url: null });
    const [error, setError] = useState("");
    return <section style={{ maxWidth: 1000, margin: "20px auto", padding: 16 }}><h1>大会ストラクチャーの入力プレビュー</h1><p>管理画面と同じ入力欄を試せます。入力内容は保存・公開されません。</p><form onSubmit={e => { e.preventDefault(); try {
        const structure = validateStructure(JSON.parse(String(new FormData(e.currentTarget).get("structure"))));
        setTournament({ ...tournament, structure, starts_at: new Date().toISOString() });
        setError("");
    }
    catch (error) {
        setError(error instanceof Error ? error.message : "入力内容を確認してください。");
    } }}><StructureEditor /><button className="btn primary" style={{ marginTop: 12 }}>入力内容で時計を開始</button></form>{error && <p role="alert">{error}</p>}<TournamentPanel tournament={tournament} serverNow={serverNow}/><TournamentPanel tournament={tournament} serverNow={serverNow} mode="structure"/></section>;
}
