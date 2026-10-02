"use client";

import { useState } from "react";

export function StorePhotoGallery({ photos, name }: {
  photos: { id: string; url: string }[];
  name: string;
}) {
  const [selected, setSelected] = useState(0);
  if (!photos.length) {
    return <div className="sd-photo-empty"><span aria-hidden="true">♠</span><p>店舗写真は準備中です</p></div>;
  }
  const move = (step: number) => setSelected((index) => (index + step + photos.length) % photos.length);
  return (
    <div className="sd-gallery">
      <div className="sd-gallery-main">
        <img src={photos[selected].url} alt={name + "の店舗写真 " + (selected + 1)} />
        {photos.length > 1 && <>
          <button type="button" className="sd-gallery-prev" aria-label="前の写真" onClick={() => move(-1)}>‹</button>
          <button type="button" className="sd-gallery-next" aria-label="次の写真" onClick={() => move(1)}>›</button>
        </>}
        <span className="sd-gallery-count" aria-live="polite">{selected + 1} / {photos.length}</span>
      </div>
      {photos.length > 1 && <div className="sd-gallery-thumbs" aria-label="店舗写真を選択">
        {photos.map((photo, index) => <button key={photo.id} type="button"
          className={index === selected ? "is-selected" : ""} aria-pressed={index === selected}
          aria-label={"写真 " + (index + 1) + "を表示"} onClick={() => setSelected(index)}>
          <img src={photo.url} alt="" loading="lazy" />
        </button>)}
      </div>}
    </div>
  );
}
