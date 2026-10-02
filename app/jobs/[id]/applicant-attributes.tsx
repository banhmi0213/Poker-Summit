"use client";
import { useState } from "react";

// 求人応募フォームの項目(2026/10、「枠の上にタブ」「年齢(18〜60)・性別
// (男・女)・ディーラー経験あり/なし(ありの場合1年未満/1年以上)」との指示を
// 受けて追加)。マイページ等のタブと同じ chip/chip-row クラスをそのまま
// 流用し、新しいCSSは追加していない。
// その後、「年齢の上から外枠つけて」「名前・年齢・性別・住所・電話番号・
// ディーラー経験・志望動機・面接希望日・PRの順にして」との指示を受け、
// 年齢・性別・ディーラー経験を他のフィールドと同じ1つの枠(card)の中に
// 指定順で差し込めるよう、3つの部品に分割した(2026/10)。
const AGE_OPTIONS = Array.from({ length: 60 - 18 + 1 }, (_, i) => 18 + i);

export function AgeField() {
  return (
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
  );
}

export function GenderField() {
  const [gender, setGender] = useState("");

  return (
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
  );
}

export function DealerExperienceField() {
  const [dealerExperience, setDealerExperience] = useState("");
  const hasExperience = dealerExperience === "under_1y" || dealerExperience === "over_1y";

  return (
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
  );
}
