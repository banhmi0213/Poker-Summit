"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiff } from "../liff-provider";
import { liffFetch } from "../api-client";
import { LiffBackLink } from "../liff-back-link";

type Photo = { id: string; url: string };

export default function LiffPhotosPage() {
  const { idToken } = useLiff();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!idToken) return;
    try {
      const data = await liffFetch<{ photos: Photo[] }>(idToken, "/api/liff/photos");
      setPhotos(data.photos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました。");
    }
  }, [idToken]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSelect(file: File | null) {
    setPendingFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function handleUpload() {
    if (!idToken || !pendingFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("photo", pendingFile);
      await liffFetch(idToken, "/api/liff/photos", { method: "POST", body: formData });
      handleSelect(null);
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました。");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!idToken) return;
    if (!window.confirm("この写真を削除しますか？")) return;
    try {
      await liffFetch(idToken, `/api/liff/photos/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  return (
    <div>
      <LiffBackLink />
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>店舗写真</h1>

      {error && <p style={{ color: "var(--critical)", fontSize: 13, marginBottom: 10 }}>{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <span className="muted">写真を追加（スマホの写真ライブラリ・カメラから選択できます）</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
          />
        </div>
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="プレビュー"
            style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 8, marginBottom: 10 }}
          />
        )}
        <button type="button" className="btn primary" disabled={!pendingFile || uploading} onClick={handleUpload}>
          {uploading ? "アップロード中…" : "アップロードする"}
        </button>
      </div>

      {photos === null && <p className="muted">読み込み中…</p>}
      {photos?.length === 0 && <p className="muted">写真はまだありません。</p>}
      {photos && photos.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8 }} />
              <button
                type="button"
                className="btn"
                style={{ fontSize: 11.5, padding: "4px 8px", marginTop: 4, width: "100%" }}
                onClick={() => handleDelete(p.id)}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
