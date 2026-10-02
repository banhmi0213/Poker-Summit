"use client";
import { useState } from "react";

// 求人応募フォームの「枠(この求人に応募するカード)」の上に表示するタブ風
// チップ選択エリア。年齢・性別・ディーラー経験を選ぶ(2026/10、「枠の上に
// タブ」「年齢(18〜60)・性別(男・女)・ディーラー経験あり/なし(ありの場合
// 1年未満/1年以上)」との指示を受けて追加)。マイページ等のタブと同じ
// chip/chip-row クラスをそのまま流用し、新しいCSSは追加していない。
const AGE_OPTIONS = Array.from({ length: 60 - 18 + 1 }, (_, i) => 18 + i);

export function ApplicantAttributesFields() {
  const [gender, setGender] = useState("");
  const [dealerExperience, setDealerExperience] = useState("");

  const hasExperience = dealerExperience === "under_1y" || dealerExperience === "over_1y";

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="field">
        <span className="muted">年齢</span>
        <select name="age" defaultValue="">
          <option value="">選択してください</option>
          {AGE_OPTIONS.map((age) => (
            <option key={age} value={age}>
              {age}歳
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="muted">性別</span>
        <input type="hidden" name="gender" value={gender} />
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${gender === "male" ? "active" : ""}`}
            onClick={() => setGender("male")}
          >
            男
          </button>
          <button
            type="button"
            className={`chip ${gender === "female" ? "active" : ""}`}
            onClick={() => setGender("female")}
          >
            女
          </button>
        </div>
      </div>

      <div className="field">
        <span className="muted">ディーラー経験</span>
        <input type="hidden" name="dealerExperience" value={dealerExperience} />
        <div className="chip-row">
          <button
            type="button"
            className={`chip ${dealerExperience === "none" ? "active" : ""}`}
            onClick={() => setDealerExperience("none")}
          >
            なし
          </button>
          <button
            type="button"
            className={`chip ${hasExperience ? "active" : ""}`}
            onClick={() => setDealerExperience("under_1y")}
          >
            あり
          </button>
        </div>
        {hasExperience && (
          <div className="chip-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className={`chip ${dealerExperience === "under_1y" ? "active" : ""}`}
              onClick={() => setDealerExperience("under_1y")}
            >
              1年未満
            </button>
            <button
              type="button"
              className={`chip ${dealerExperience === "over_1y" ? "active" : ""}`}
              onClick={() => setDealerExperience("over_1y")}
            >
              1年以上
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
