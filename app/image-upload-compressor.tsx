"use client";

import { useEffect } from "react";

// 画像アップロードの自動縮小(サイト全体共通)。
// <input type="file"> で画像が選ばれた瞬間に、ブラウザ側で長辺 MAX_SIDE px に縮めて
// WebP(非対応ブラウザはJPEG)に変換し、選択されたファイルを差し替える。
// サーバーへ送る前に小さくなるので、店舗写真・バナー・ブログ画像などが全部軽くなり、
// アップロードも速くなる。各フォームの処理は変えずに済む。
//
// - GIF(アニメーション)・SVGは変換しない
// - すでに十分小さい画像はそのまま
// - 変換に失敗した場合(ブラウザが読めない形式など)は元のファイルのまま
// - 個別に止めたい入力欄は data-no-compress を付ける

const MAX_SIDE = 1600;
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 300 * 1024;
const REDISPATCHED = "__psCompressed";

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* 下の <img> 読み込みで再挑戦 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || /gif|svg/.test(file.type)) return file;
  const source = await decode(file);
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!w || !h) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  if (scale === 1 && file.size <= SKIP_BELOW_BYTES) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  // WebPが作れないブラウザ(古いSafari等)は、透過のあるPNGはPNGのまま、それ以外はJPEG
  let blob = await toBlob(canvas, "image/webp", QUALITY);
  if (!blob || blob.type !== "image/webp") {
    blob = file.type === "image/png" ? await toBlob(canvas, "image/png", 1) : await toBlob(canvas, "image/jpeg", QUALITY);
  }
  if (!blob || blob.size >= file.size) return file;
  const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  const base = (file.name || "image").replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
}

export function ImageUploadCompressor() {
  useEffect(() => {
    if (typeof DataTransfer === "undefined") return;

    const onChange = async (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      if ((event as Event & { [REDISPATCHED]?: boolean })[REDISPATCHED]) return;
      if (input.hasAttribute("data-no-compress")) return;
      const files = Array.from(input.files ?? []);
      if (!files.some((f) => f.type.startsWith("image/") && !/gif|svg/.test(f.type))) return;

      // 元のイベントは止めて、縮小後のファイルで改めて change を発火する
      // (プレビュー表示など、選んだ瞬間にファイルを読む処理にも縮小後のものが渡る)
      event.stopImmediatePropagation();
      input.setAttribute("aria-busy", "true");
      const form = input.form;
      const submits = form ? Array.from(form.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[type="submit"]')) : [];
      const wasDisabled = submits.map((b) => b.disabled);
      submits.forEach((b) => (b.disabled = true));
      try {
        const out = await Promise.all(files.map((f) => compress(f).catch(() => f)));
        if (out.some((f, i) => f !== files[i])) {
          const dt = new DataTransfer();
          out.forEach((f) => dt.items.add(f));
          input.files = dt.files;
        }
      } finally {
        submits.forEach((b, i) => (b.disabled = wasDisabled[i]));
        input.removeAttribute("aria-busy");
        const again = new Event("change", { bubbles: true }) as Event & { [REDISPATCHED]?: boolean };
        again[REDISPATCHED] = true;
        input.dispatchEvent(again);
      }
    };

    document.addEventListener("change", onChange, true);
    return () => document.removeEventListener("change", onChange, true);
  }, []);

  return null;
}
