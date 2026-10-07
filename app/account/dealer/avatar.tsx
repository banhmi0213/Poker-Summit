import type { DealerAvatarKind } from "@/lib/dealers";
import styles from "./dealer.module.css";

export function DealerAvatar({ kind, photo, name, small = false }: { kind?: DealerAvatarKind | null; photo?: string | null; name: string; small?: boolean }) {
 const size = small ? styles.avatarSmall : styles.avatar;
 if (kind === "male" || kind === "female") return <span role="img" aria-label={name+"の"+(kind === "male" ? "男性" : "女性")+"シルエット"} className={size+" "+styles.silhouette+" "+(kind === "male" ? styles.silhouetteMale : styles.silhouetteFemale)} />;
 if (photo) return <img className={size} src={photo} alt={name+"のプロフィール写真"} />;
 return <span className={size+" "+styles.avatarEmpty}>写真未登録</span>;
}
