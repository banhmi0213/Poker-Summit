"use client";

import { useState } from "react";

// 店舗詳細ページの写真ギャラリー。2026/10、TOPから店舗詳細に入ったときの
// デザインを「大きい写真＋左右矢印＋下にサムネ4枚」の見た目に合わせるため追加。
// 店舗管理画面でアップロードされたstore_photosをそのまま並べるだけで、
// 枚数が0〜1枚のときは矢印・サムネを出さずに崩れないようにしてある。
export function StoreGallery({
  photos,
  name,
}: {
  photos: { id: string; url: string }[];
  name: string;
}) {
  const [index, setIndex] = useState(0);

  if (!photos || photos.length === 0) {
    return (
      <div
        className="store-gallery-main"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}
      >
        写真はまだ登録されていません
      </div>
    );
  }

  const current = photos[Math.min(index, photos.length - 1)];
  const canNav = photos.length > 1;

  function go(delta: number) {
    setIndex((i) => (i + delta + photos.length) % photos.length);
  }

  return (
    <div>
      <div className="store-gallery-main">
        <img src={current.url} alt={name} />
        {canNav && (
          <>
            <button
              type="button"
              className="store-gallery-nav prev"
              onClick={() => go(-1)}
              aria-label="前の写真"
            >
              ‹
            </button>
            <button
              type="button"
              className="store-gallery-nav next"
              onClick={() => go(1)}
              aria-label="次の写真"
            >
              ›
            </button>
          </>
        )}
      </div>
      {canNav && (
        <div className="store-gallery-thumbs">
          {photos.map((p, i) => (
            <button
              type="button"
              key={p.id}
              className={`store-gallery-thumb${i === index ? " active" : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`写真 ${i + 1}`}
            >
              <img src={p.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
