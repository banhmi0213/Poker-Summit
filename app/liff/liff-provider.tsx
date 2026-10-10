"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type LiffState = {
  ready: boolean;
  error: string | null;
  idToken: string | null;
  displayName: string | null;
  // 公式アカウントと友だちかどうか(わからないときは null)
  isFriend: boolean | null;
};

const initialState: LiffState = {
  ready: false,
  error: null,
  idToken: null,
  displayName: null,
  isFriend: null,
};

const LiffContext = createContext<LiffState>(initialState);

// Initializes the LINE LIFF SDK once, on the client only (liff.init touches
// window/localStorage and can't run during SSR). Every /liff/* page reads
// the resulting idToken from this context and sends it as a Bearer token to
// our /api/liff/* routes — the routes verify it server-side, so this
// component never needs to "trust" its own state, just surface it.
export function LiffProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiffState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        if (!cancelled) {
          setState({
            ready: true,
            error: "LIFFの設定が完了していません。運営にお問い合わせください。",
            idToken: null,
            displayName: null,
            isFriend: null,
          });
        }
        return;
      }

      try {
        const liffModule = await import("@line/liff");
        const liff = liffModule.default;

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return; // liff.login() navigates away; nothing left to set here
        }

        const idToken = liff.getIDToken();
        let displayName: string | null = null;
        try {
          const profile = await liff.getProfile();
          displayName = profile.displayName;
        } catch {
          // Profile scope may not be granted — not fatal, the ID token is
          // what actually authorizes API calls.
        }

        let isFriend: boolean | null = null;
        try {
          isFriend = (await liff.getFriendship()).friendFlag;
        } catch {
          isFriend = null;
        }

        if (!cancelled) {
          setState({
            ready: true,
            error: idToken ? null : "LINEのIDトークンを取得できませんでした。アプリを開き直してください。",
            idToken,
            displayName,
            isFriend,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            ready: true,
            error: e instanceof Error ? e.message : "LIFFの初期化に失敗しました。",
            idToken: null,
            displayName: null,
            isFriend: null,
          });
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  return <LiffContext.Provider value={state}>{children}</LiffContext.Provider>;
}

export function useLiff() {
  return useContext(LiffContext);
}
