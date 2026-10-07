"use client";
import { useEffect, useRef, useState } from "react";
import type { DealerAvatarKind } from "@/lib/dealers";
import { DealerAvatar } from "./avatar";
import styles from "./dealer.module.css";

export function DealerPhotoField({ kind, photo, hasPhoto }: { kind: DealerAvatarKind | null; photo: string | null; hasPhoto: boolean }) {
 const [selected, setSelected] = useState<DealerAvatarKind | "">(kind ?? "");
 const [uploadPreview, setUploadPreview] = useState<string | null>(null);
 const [removePhoto, setRemovePhoto] = useState(false);
 const [error, setError] = useState("");
 const fileInput = useRef<HTMLInputElement>(null);
 useEffect(() => () => { if (uploadPreview) URL.revokeObjectURL(uploadPreview); }, [uploadPreview]);
 const choose = (value: DealerAvatarKind) => {
  setSelected(value); setUploadPreview(null); setError("");
  if (fileInput.current) fileInput.current.value = "";
 };
 const shownPhoto = uploadPreview ?? (removePhoto ? null : photo);
 return <div className={styles.wide}>
  <label className={styles.field} htmlFor="dealer-profile-photo">プロフィール写真</label>
  {(shownPhoto || selected) && <div className={styles.photoPreview} aria-live="polite"><DealerAvatar kind={selected || null} photo={shownPhoto} name="選択中" /></div>}
  <input className={styles.photoUpload} ref={fileInput} id="dealer-profile-photo" type="file" name="photo" accept="image/jpeg,image/png,image/webp" onChange={event => {
   const file = event.target.files?.[0]; if (!file) return;
   if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 3*1024*1024) { setError("写真はJPEG・PNG・WebP、3MB以内で選んでください。"); event.target.value = ""; return; }
   setError(""); setUploadPreview(URL.createObjectURL(file)); setSelected(""); setRemovePhoto(false);
  }} />
  <p className={styles.hint}>JPEG・PNG・WebP、3MB以内。写真は本人と店舗アカウントだけが閲覧できます。</p>
  {error && <p className="err" role="alert">{error}</p>}
  {hasPhoto && <label className={styles.removePhoto}><input type="checkbox" name="removePhoto" checked={removePhoto} onChange={event => setRemovePhoto(event.target.checked)} /> 現在の写真を削除する</label>}
  <fieldset className={styles.silhouetteChoices}><legend>写真の代わりにシルエットを使う</legend>
   <p className={styles.hint}>表示したい画像を選んでください。</p>
   <div className={styles.silhouetteGrid}>{(["male","female"] as const).map(value => <label key={value} className={styles.silhouetteChoice}>
    <DealerAvatar kind={value} name={value === "male" ? "男性" : "女性"} />
    <span><input type="radio" name="avatarKind" value={value} checked={selected === value} onChange={() => choose(value)} />{value === "male" ? "男性" : "女性"}シルエット</span>
   </label>)}</div>
   {selected && <button type="button" className={styles.clearSilhouette} onClick={() => setSelected("")}>シルエットの選択を解除</button>}
   <span className={styles.selectionStatus} role="status">{selected ? (selected === "male" ? "男性" : "女性")+"シルエットを使用します。" : uploadPreview ? "選択した写真を使用します。" : ""}</span>
  </fieldset>
 </div>;
}
