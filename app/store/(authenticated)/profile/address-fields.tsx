"use client";

import { useState } from "react";

/**
 * 都道府県・市区町村・住所の3項目。都道府県 or 市区町村を入力すると、
 * 住所欄の先頭に「都道府県+市区町村」を自動反映する(2026/09/30)。
 *
 * 住所欄はユーザーが番地・建物名などを手入力で続けて足す想定なので、
 * 単純に毎回上書きするのではなく「直近に自動反映した都道府県+市区町村
 * の文字列」を覚えておき、住所欄がその文字列のまま(=まだ手入力してい
 * ない)か、その文字列で始まっている(=先頭は自動反映のままで続きだけ
 * 手入力済み)場合だけ、先頭部分を新しい値に差し替える。すでに住所欄が
 * それと無関係な内容になっていれば(自動反映と無関係に手入力済み)、
 * 上書きせずそのまま残す。
 */
export function AddressFields({
  prefOptions,
  initialPref,
  initialCity,
  initialAddress,
  disabled,
}: {
  prefOptions: readonly string[];
  initialPref: string;
  initialCity: string;
  initialAddress: string;
  disabled: boolean;
}) {
  const [pref, setPref] = useState(initialPref);
  const [city, setCity] = useState(initialCity);
  const [address, setAddress] = useState(initialAddress);

  const initialAuto = `${initialPref}${initialCity}`;
  const [autoPrefix, setAutoPrefix] = useState(
    initialAuto && initialAddress.startsWith(initialAuto) ? initialAuto : ""
  );

  function syncAddress(nextPref: string, nextCity: string) {
    const nextAuto = `${nextPref}${nextCity}`;
    setAddress((prev) => {
      if (prev === "" || prev === autoPrefix) {
        return nextAuto;
      }
      if (autoPrefix && prev.startsWith(autoPrefix)) {
        return nextAuto + prev.slice(autoPrefix.length);
      }
      return prev;
    });
    setAutoPrefix(nextAuto);
  }

  return (
    <>
      <div className="field">
        <span className="muted">都道府県</span>
        {disabled && <input type="hidden" name="pref" value={pref} />}
        <select
          name={disabled ? undefined : "pref"}
          value={pref}
          disabled={disabled}
          onChange={(e) => {
            setPref(e.target.value);
            syncAddress(e.target.value, city);
          }}
        >
          <option value="">未設定</option>
          {prefOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="muted">市区町村</span>
        <input
          type="text"
          name="city"
          value={city}
          readOnly={disabled}
          style={disabled ? { background: "var(--surface-2)" } : undefined}
          onChange={(e) => {
            setCity(e.target.value);
            syncAddress(pref, e.target.value);
          }}
        />
      </div>
      <div className="field">
        <span className="muted">住所</span>
        <input
          type="text"
          name="address"
          value={address}
          readOnly={disabled}
          style={disabled ? { background: "var(--surface-2)" } : undefined}
          onChange={(e) => setAddress(e.target.value)}
        />
        {disabled ? (
          <span className="muted" style={{ fontSize: 11.5 }}>
            ⏳ 新しい住所への変更は運営の承認待ちです。承認されるまでこれらの欄は編集できません。
          </span>
        ) : (
          <span className="muted" style={{ fontSize: 11.5 }}>
            住所の変更は地図・現在地検索・ナビに影響するため、保存後は運営の承認を経てから反映されます(反映時に座標も自動取得されます)。都道府県・市区町村を入力すると住所欄の先頭に自動で反映されます。
          </span>
        )}
      </div>
    </>
  );
}
