import Link from "next/link";
import { CATEGORY_LABEL, CATEGORY_COLOR, CATEGORY_ICON } from "@/lib/constants";

export function StoreCard({
  store,
  isFavorite,
  favoriteAction,
}: {
  store: {
    id: string;
    name: string;
    category: string | null;
    pref: string | null;
    city: string | null;
    description: string | null;
  };
  isFavorite: boolean;
  favoriteAction: () => Promise<void>;
}) {
  const color = CATEGORY_COLOR[store.category ?? ""] ?? "#3987e5";
  const icon = CATEGORY_ICON[store.category ?? ""] ?? "♠️";
  const desc = store.description ?? "";

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
      <form action={favoriteAction}>
        <button
          type="submit"
          className={`store-fav-btn ${isFavorite ? "active" : ""}`}
          aria-label="お気に入り"
        >
          {isFavorite ? "♥" : "♡"}
        </button>
      </form>
      <Link href={`/stores/${store.id}`} style={{ display: "block", color: "inherit" }}>
        <div
          style={{
            background: color,
            height: 92,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            color: "#fff",
          }}
        >
          {icon}
        </div>
        <div style={{ padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{store.name}</div>
          {store.category && (
            <span className="badge" style={{ marginBottom: 6 }}>
              {CATEGORY_LABEL[store.category] ?? store.category}
            </span>
          )}
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            📍 {[store.pref, store.city].filter(Boolean).join(" ")}
          </div>
          {desc && (
            <p className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
              {desc.slice(0, 40)}
              {desc.length > 40 ? "…" : ""}
            </p>
          )}
        </div>
      </Link>
    </div>
  );
}
