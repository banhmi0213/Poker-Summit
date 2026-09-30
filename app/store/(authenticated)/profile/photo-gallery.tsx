"use client";

import { useState, type CSSProperties } from "react";
import { deleteStorePhoto } from "./photos-actions";

type Photo = { id: string; url: string };

// 店舗写真を「ギャラリー」表示(グリッド+クリックで拡大するライトボックス)
// にするための独立クライアントコンポーネント。page.tsx はサーバー
// コンポーネントでクリック状態を持てないため分離した
// (2026/09/30、「店舗写真をギャラリーに変更」との指示)。
export function PhotoGallery({ photos, storeId }: { photos: Photo[]; storeId: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!photos.length) return null;

  const openPhoto = openIndex !== null ? photos[openIndex] : null;

  async function handleDelete(photoId: string) {
    if (!confirm("この写真を削除しますか？")) return;
    setDeletingId(photoId);
    try {
      await deleteStorePhoto(photoId, storeId);
      setOpenIndex(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: 10,
          marginTop: 16,
        }}
      >
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              aspectRatio: "1 / 1",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <img
              src={p.url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </button>
        ))}
      </div>

      {openPhoto && (
        <div
          onClick={() => setOpenIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          {openIndex !== null && openIndex > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(openIndex - 1);
              }}
              style={navBtnStyle("left")}
              aria-label="前の写真"
            >
              ‹
            </button>
          )}
          {openIndex !== null && openIndex < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(openIndex + 1);
              }}
              style={navBtnStyle("right")}
              aria-label="次の写真"
            >
              ›
            </button>
          )}
          <img
            src={openPhoto.url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "75vh", objectFit: "contain", borderRadius: 8 }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(openPhoto.id);
              }}
              disabled={deletingId === openPhoto.id}
              style={{ background: "#fff" }}
            >
              {deletingId === openPhoto.id ? "削除中..." : "この写真を削除"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex(null);
              }}
              style={{ background: "#fff" }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function navBtnStyle(side: "left" | "right"): CSSProperties {
  return {
    position: "fixed",
    top: "50%",
    [side]: 16,
    transform: "translateY(-50%)",
    fontSize: 28,
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.9)",
    cursor: "pointer",
    zIndex: 1001,
  };
}
