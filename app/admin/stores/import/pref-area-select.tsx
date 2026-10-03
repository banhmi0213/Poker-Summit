"use client";

import { useState } from "react";
import { AREA_OPTIONS, PREF_OPTIONS, REGIONS, primaryRegionForPref } from "@/lib/constants";

// 店舗取込(Google Places)フォームの「都道府県」「エリア」の組。/stores の
// 利用者向け検索フォーム(app/pref-area-select.tsx)と同じ発想で、都道府県を
// 選ぶとエリアの選択肢がその都道府県のエリア一覧(AREA_OPTIONS)に即座に
// 切り替わる(クライアント側のみ、ページ遷移なし)。2026/10、「エリアは
// 都道府県選んだら各都道府県に合わせて東京なら新宿、池袋 大阪なら梅田、
// 難波ってでるようにして、店舗検索がそうなってるやんけ」との指摘を受け、
// 自由入力だったエリア欄を/storesと同じAREA_OPTIONS連動のセレクトに変更。
//
// AREA_OPTIONSの各都道府県の最後の要素は「その他◯◯」という/stores側の
// 絞り込み専用の受け皿ラベルであり、実在する地名ではないため、Google
// Places検索のキーワードに使うとノイズになる。ここでは一覧から除外する。
//
// initialPrefは前回検索した都道府県(cookie経由、page.tsx側で読み込み)。
// 都道府県を選び直すまでは前回の値を引き継ぎ、エリアを選ぶだけで次の
// 検索に進めるようにする(2026/10、「都道府県を選んだ場合は検索後また
// 都道府県から選ばなあかんくなる」との指摘を受けて追加)。
export function ImportPrefAreaSelect({ initialPref = "" }: { initialPref?: string }) {
  const [pref, setPref] = useState(initialPref);
  const areaOptions = pref
    ? (AREA_OPTIONS[pref] ?? []).filter((a) => !a.startsWith("その他"))
    : [];

  return (
    <>
      <div className="field">
        <span className="muted">都道府県 *</span>
        <select
          name="pref"
          required
          value={pref}
          onChange={(e) => setPref(e.target.value)}
        >
          <option value="" disabled>
            選択してください
          </option>
          {REGIONS.map((region) => (
            <optgroup key={region} label={region}>
              {PREF_OPTIONS.filter((p) => primaryRegionForPref(p) === region).map(
                (p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )
              )}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="muted">エリア</span>
        {/* key={pref}で都道府県が変わるたびに選択をリセットする(前の
            都道府県のエリア名が値として残らないようにするため)。 */}
        <select key={pref} name="area" disabled={!pref} defaultValue="">
          <option value="">{pref ? "エリア: 指定しない" : "先に都道府県を選んでください"}</option>
          {areaOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: 11.5 }}>
          都道府県内の駅名・繁華街エリアで絞り込みたい場合に選択してください(任意)。
        </span>
      </div>
    </>
  );
}
