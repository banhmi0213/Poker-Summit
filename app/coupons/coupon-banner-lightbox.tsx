"use client";

import { useState } from "react";

// クーポン画像の「広告を拡大」(2026/10、提供されたモックアップに合わせて
// 追加)。1枚の画像だけを扱う、全画面オーバーレイでの拡大表示。複数枚を
// 前後送りする app/store/(authenticated)/profile/photo-gallery.tsx の
// オーバーレイ部分だけを、単体画像用に簡略化したもの。
export function CouponBannerLightbox({
  imageUrl,
  alt,
}: {
  imageUrl: string;
  alt: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img src={imageUrl} alt={alt} loading="lazy" />
      <button
        type="button"
        className="coupon-card__zoom"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        🔍 広告を拡大
      </button>
      {open && (
        <div
          className="coupon-lightbox"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="coupon-lightbox__close"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            aria-label="閉じる"
          >
            ×
          </button>
          <img src={imageUrl} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
