"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BANNER_POSITIONS } from "@/lib/banners";
import { saveBanner, type BannerFormState } from "./actions";
import styles from "./banners.module.css";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export type EditableBanner = {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  position: string;
  scope: string | null;
  sort_order: number;
  active: boolean;
  startsAtLocal: string;
  endsAtLocal: string;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn primary ${styles.submit}`} disabled={pending} aria-busy={pending}>
      {pending && <span className={styles.spinner} aria-hidden="true" />}
      {pending ? "アップロード中…" : label}
    </button>
  );
}

function validateFile(file: File): string | null {
  if (!ACCEPT.includes(file.type)) return "JPEG・PNG・WebP形式の画像を選択してください。";
  if (file.size > MAX_IMAGE_BYTES) {
    return `画像は3MB以内にしてください（選択した画像: ${(Math.ceil((file.size / 1024 / 1024) * 10) / 10).toFixed(1)}MB）。`;
  }
  return null;
}

export function BannerForm({ banner }: { banner?: EditableBanner }) {
  const isEdit = Boolean(banner);
  const router = useRouter();
  const [state, action] = useFormState<BannerFormState, FormData>(saveBanner, {});
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(banner?.position ?? "top");

  // プレビュー用のオブジェクトURLは差し替え時・破棄時に解放する。
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    if (!state.savedAt) return;
    if (isEdit) {
      router.replace("/admin/banners");
    } else {
      formRef.current?.reset();
      setPreview(null);
      setFileName("");
      setPosition("top");
    }
  }, [state.savedAt, isEdit, router]);

  function clearFile() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setFileName("");
  }

  function pickFile(file: File | undefined, fromDrop = false) {
    if (!file) {
      clearFile();
      return;
    }
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      clearFile();
      return;
    }
    if (fromDrop && inputRef.current) {
      // ドロップしたファイルを<input type="file">に入れ、通常の送信に乗せる。
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
    setFileError(null);
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  const shownImage = preview ?? banner?.image_url ?? null;

  return (
    <form ref={formRef} action={action} className={styles.form}>
      {banner && <input type="hidden" name="id" value={banner.id} />}

      <label className="field">
        <span className="muted">バナー名 *（画像の代替テキストにも使います）</span>
        <input type="text" name="title" required maxLength={200} defaultValue={banner?.title ?? ""} />
      </label>

      <div className="field">
        <span className="muted">画像ファイル（JPEG・PNG・WebP／3MBまで。推奨 1200×400px）</span>
        {banner?.image_url && !preview && (
          <div className={styles.current}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.image_url} alt={banner.title} className={styles.currentImage} />
            <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
              画像を差し替える
            </button>
          </div>
        )}
        {!(banner?.image_url && !preview) && (
        <div
          className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pickFile(e.dataTransfer.files?.[0], true);
          }}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="選択した画像のプレビュー" className={styles.preview} />
              <span className={styles.fileName}>{fileName}</span>
              <span className={styles.dropActions}>
                <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
                  別の画像を選ぶ
                </button>
                <button type="button" className="btn" onClick={clearFile}>
                  {banner?.image_url ? "差し替えをやめる" : "選択を取り消す"}
                </button>
              </span>
            </>
          ) : (
            <>
              <span>ここに画像をドラッグ&ドロップ</span>
              <span className="muted">または</span>
              <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
                ファイルを選択
              </button>
            </>
          )}
        </div>
        )}
        <input
          ref={inputRef}
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {fileError && (
          <p className="err" role="alert">
            {fileError}
          </p>
        )}
        {position === "top" && !shownImage && (
          <small className="muted">TOPページのスライダーには画像のあるバナーだけが表示されます。</small>
        )}
      </div>

      <label className="field">
        <span className="muted">リンク先URL（https:// または http://。空欄ならリンクなし）</span>
        <input
          type="url"
          name="linkUrl"
          placeholder="https://..."
          pattern="https?://.+"
          defaultValue={banner?.link_url ?? ""}
        />
      </label>

      <label className="field">
        <span className="muted">表示位置</span>
        <select name="position" value={position} onChange={(e) => setPosition(e.target.value)}>
          {BANNER_POSITIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="muted">絞り込み範囲（都道府県名 or 地方名。空欄で全体に表示）</span>
        <input type="text" name="scope" placeholder="例: 東京都 / 関東" defaultValue={banner?.scope ?? ""} />
        {position === "top" && (
          <small className="muted">TOPページでは、絞り込み範囲が空欄のバナーだけを表示します。</small>
        )}
      </label>

      <label className="field">
        <span className="muted">表示順（小さいほど先）</span>
        <input type="number" name="sortOrder" step={1} defaultValue={banner?.sort_order ?? 0} />
      </label>

      <div className={styles.row}>
        <label className="field">
          <span className="muted">掲載開始日時（任意）</span>
          <input type="datetime-local" name="startsAt" defaultValue={banner?.startsAtLocal ?? ""} />
        </label>
        <label className="field">
          <span className="muted">掲載終了日時（任意）</span>
          <input type="datetime-local" name="endsAt" defaultValue={banner?.endsAtLocal ?? ""} />
        </label>
      </div>

      <label className={styles.checkbox}>
        <input type="checkbox" name="active" defaultChecked={banner?.active ?? true} />
        表示する（OFFにするとサイトに出ません）
      </label>

      {state.error && (
        <p className="err" role="alert">
          {state.error}
        </p>
      )}
      {state.success && !isEdit && (
        <p className={styles.ok} role="status">
          {state.success}
        </p>
      )}

      <div className={styles.actions}>
        <SubmitButton label={isEdit ? "更新する" : "追加する"} />
        {isEdit && (
          <Link href="/admin/banners" className="btn">
            キャンセル
          </Link>
        )}
      </div>
    </form>
  );
}

export function DeleteBannerButton({ action, title }: { action: () => Promise<void>; title: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`「${title}」を削除しますか？\n画像と表示・クリックの計測データも削除され、元に戻せません。`)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn">
        削除
      </button>
    </form>
  );
}
