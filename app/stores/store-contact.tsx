"use client";
// 店舗の連絡先(住所・電話番号・メール・SNS・Googleマップの場所)を、ページを開いたあとに取りに行って出す(2026/11/10 オーナー：店舗情報が抜かれまくっている)。
// ページの HTML には連絡先を入れない。/api/store-contact が BotID で自動操作のブラウザを断る。普通の人には一瞬遅れて出るだけ。
import { useEffect, useState, type ReactNode } from "react";

export type StoreContact = {
  id: string;
  address: string | null;
  tel: string | null;
  email: string | null;
  line_url: string | null;
  x_url: string | null;
  instagram_url: string | null;
  google_place_id: string | null;
};
type State = { status: "loading" | "ok" | "error"; contact: StoreContact | null };

// 同じページの中の呼び出しはまとめて1回で取りに行く(一覧で何店も出すときも1回)。
const cache = new Map<string, Promise<StoreContact | null>>();
let queue: { id: string; resolve: (c: StoreContact | null) => void; reject: (e: unknown) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  const batch = queue;
  queue = [];
  timer = null;
  const ids = Array.from(new Set(batch.map((b) => b.id)));
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    fetch("/api/store-contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: chunk }), credentials: "same-origin", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { stores?: StoreContact[] };
        const byId = new Map((json.stores ?? []).map((s) => [s.id, s]));
        for (const b of batch) if (chunk.includes(b.id)) b.resolve(byId.get(b.id) ?? null);
      })
      .catch((e) => {
        for (const b of batch) if (chunk.includes(b.id)) { cache.delete(b.id); b.reject(e); }
      });
  }
}

function loadContact(id: string): Promise<StoreContact | null> {
  let p = cache.get(id);
  if (!p) {
    p = new Promise((resolve, reject) => {
      queue.push({ id, resolve, reject });
      if (!timer) timer = setTimeout(flush, 0);
    });
    cache.set(id, p);
  }
  return p;
}

export function useStoreContact(id: string): State {
  const [state, setState] = useState<State>({ status: "loading", contact: null });
  useEffect(() => {
    let alive = true;
    loadContact(id).then(
      (contact) => alive && setState({ status: "ok", contact }),
      () => alive && setState({ status: "error", contact: null }),
    );
    return () => { alive = false; };
  }, [id]);
  return state;
}

const telDigits = (tel: string | null | undefined) => (tel ? String(tel).replace(/[^+0-9]/g, "") : "");

// 住所の番地(1-1-22 など)や部屋番号が途中で改行されないよう、数字のかたまりは1つにまとめる
function keepNumbersTogether(text: string) {
  return text.split(/([0-9０-９]+(?:[-－ー‐−][0-9０-９]+)*(?:号室|号|階|F)?)/).map((part, i) =>
    i % 2 === 1 ? <span key={i} style={{ whiteSpace: "nowrap" }}>{part}</span> : part
  );
}

/** 住所。読み込むまでは都道府県・市区町村を出しておく。 */
export function StoreAddress({ id, fallback }: { id: string; fallback: string }) {
  const { contact } = useStoreContact(id);
  const text = contact?.address || fallback || "未登録";
  return <>{keepNumbersTogether(text)}</>;
}

/** 電話番号(タップで電話)。 */
export function StorePhoneText({ id }: { id: string }) {
  const { status, contact } = useStoreContact(id);
  if (status === "loading") return <span className="muted">読み込み中</span>;
  if (status === "error") return <span className="muted">表示できませんでした。ページを読み込み直してください。</span>;
  if (!contact?.tel) return <>未登録</>;
  return <a href={`tel:${telDigits(contact.tel)}`}>{contact.tel}</a>;
}

/** 電話番号があるときだけ出すボタン。無いときは fallback(お問い合わせなど)。 */
export function StorePhoneButton({ id, className, style, children, fallback = null }: { id: string; className?: string; style?: React.CSSProperties; children: ReactNode; fallback?: ReactNode }) {
  const { status, contact } = useStoreContact(id);
  const digits = telDigits(contact?.tel);
  if (status === "loading") return null;
  if (!digits) return <>{fallback}</>;
  return <a href={`tel:${digits}`} className={className} style={style}>{children}</a>;
}

/** 地図・経路のリンク。Googleマップの場所(place_id)がわかれば、その場所で開く。 */
export function StoreMapLink({ id, name, fallbackHref, className, children }: { id: string; name: string; fallbackHref: string; className?: string; children: ReactNode }) {
  const { contact } = useStoreContact(id);
  const href = contact?.google_place_id
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(contact.google_place_id)}`
    : contact?.address
      ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(contact.address + " " + name)
      : fallbackHref;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}

/** 緯度経度が無い店舗だけ、住所で地図を埋め込む。 */
export function StoreMapEmbedByAddress({ id, title }: { id: string; title: string }) {
  const { contact } = useStoreContact(id);
  if (!contact?.address) return null;
  return <iframe className="sd-map" title={title} src={"https://maps.google.com/maps?q=" + encodeURIComponent(contact.address) + "&output=embed"} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />;
}

/** メール・LINE・X・Instagram のアイコン。値が入っているものだけ出す。アイコンの絵はページから渡す。 */
export function StoreContactIcons({ id, icons }: { id: string; icons: { email: ReactNode; line: ReactNode; x: ReactNode; instagram: ReactNode } }) {
  const { contact } = useStoreContact(id);
  if (!contact) return null;
  return (
    <>
      {contact.email && <a href={`mailto:${contact.email}`} aria-label="メール" data-store-contact="email" style={{ display: "inline-flex", color: "#63a5ac", width: 28, height: 28 }}>{icons.email}</a>}
      {contact.line_url && <a href={contact.line_url} target="_blank" rel="noopener noreferrer" aria-label="LINE" data-store-contact="line" style={{ display: "inline-flex", width: 28, height: 28 }}>{icons.line}</a>}
      {contact.x_url && <a href={contact.x_url} target="_blank" rel="noopener noreferrer" aria-label="X" data-store-contact="x" style={{ display: "inline-flex", color: "#222", width: 28, height: 28 }}>{icons.x}</a>}
      {contact.instagram_url && <a href={contact.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" data-store-contact="instagram" style={{ display: "inline-flex", width: 28, height: 28 }}>{icons.instagram}</a>}
    </>
  );
}
