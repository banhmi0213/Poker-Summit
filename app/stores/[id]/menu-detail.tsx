"use client";
import { useRef } from "react";
export function MenuDetail({name, price, description}: {name: string; price?: string | null; description?: string | null}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <><button className="btn sd-menu-more" type="button" onClick={() => dialog.current?.showModal()}>詳細を見る ›</button>
    <dialog ref={dialog} className="sd-menu-dialog" onClick={event => { if(event.target === event.currentTarget) dialog.current?.close(); }}>
      <h2>{name}</h2>{price && <p className="sd-menu-price">{price}</p>}<p>{description || "詳しくは店舗にお問い合わせください。"}</p>
      <button className="btn" type="button" onClick={() => dialog.current?.close()}>閉じる</button>
    </dialog></>;
}
