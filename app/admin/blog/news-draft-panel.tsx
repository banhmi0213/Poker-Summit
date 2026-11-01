"use client";
import { useFormState } from "react-dom";
import { PendingSubmitButton } from "@/app/pending-submit-button";
import { runNewsDraftNow, type NewsDraftState } from "./news-actions";

export function NewsDraftPanel({ keySet, draftCount }: { keySet: boolean; draftCount: number }) {
  const [state, action] = useFormState<NewsDraftState, FormData>(runNewsDraftNow, {});
  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>ポーカーニュースの自動下書き</h2>
      <p style={{ marginBottom: 12, lineHeight: 1.8 }}>
        毎日6時と15時（日本時間）に、直近のポーカーニュースを1本ずつ探して下書きを作ります。公開はされません。内容・出典・画像を確認してから公開してください。
        {draftCount > 0 && <><br />確認待ちの自動下書き：{draftCount}件</>}
      </p>
      {!keySet && <p className="err" style={{ marginBottom: 12 }}>AIのAPIキー（ANTHROPIC_API_KEY）が設定されていないため、まだ動いていません。Vercelの環境変数に追加してください。</p>}
      <form action={action}>
        <PendingSubmitButton className="btn" pendingLabel="ニュースを探して書いています（1〜3分）…">ニュースの下書きを今すぐ1本作る</PendingSubmitButton>
      </form>
      {state.error && <p className="err" style={{ marginTop: 8 }}>{state.error}</p>}
      {state.success && <p className="ok" style={{ marginTop: 8 }}>{state.success}</p>}
    </section>
  );
}
