import "server-only";
import { ImageResponse } from "next/og";
import { SITE_URL } from "@/lib/seo";

// 自動ニュース記事のメイン画像(2026/10/23)。ニュースサイトの写真は使わず、
// サイトの色(黒地に金)で記事タイトルを入れた画像をその都度作る(権利の心配がない)。
// 日本語の文字はGoogle Fontsから、その画像で使う文字だけを取ってくる。

async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&text=${encodeURIComponent(text)}`, {
      signal: AbortSignal.timeout(10000),
    }).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url, { signal: AbortSignal.timeout(10000) }).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

/** 1200x630のPNG。作れなかったときは null */
export async function renderNewsCard(title: string, category: string): Promise<Uint8Array | null> {
  const label = "POKER SUMMIT NEWS";
  const date = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, ".");
  const font = await loadFont(`${title}${category}${label}${date}0123456789.`);
  if (!font) return null;
  const size = title.length > 44 ? 50 : title.length > 28 ? 58 : 66;
  try {
    const res = new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", padding: 28, background: "#120e0a" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "48px 60px",
              border: "3px solid #c99a45",
              borderRadius: 24,
              background: "linear-gradient(155deg, #241b12 0%, #120e0a 60%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <img src={`${SITE_URL}/images/logo.png`} width={225} height={75} alt="" />
              <div style={{ display: "flex", padding: "8px 22px", borderRadius: 999, background: "#d4af37", color: "#2a1c06", fontSize: 28 }}>{category}</div>
            </div>
            <div style={{ display: "flex", color: "#fff8e6", fontSize: size, lineHeight: 1.35 }}>{title}</div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#c99a45", fontSize: 26, letterSpacing: 2 }}>
              <span>{label}</span>
              <span>{date}</span>
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630, fonts: [{ name: "Noto Sans JP", data: font, weight: 700, style: "normal" }] }
    );
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
