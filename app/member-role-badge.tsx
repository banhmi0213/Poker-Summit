import styles from "./member-role-badge.module.css";

// 会員がプロフィールで設定した役職(profiles.role)のバッジ。値は
// lib/constants.ts の MEMBER_ROLE_OPTIONS の文言がそのまま保存されている
// ので、そのまま表示する(選択肢から外れた古い値も文字のまま出す)。
// 役職が空・未設定なら何も描画しない。
export function MemberRoleBadge({ role }: { role: string | null | undefined }) {
  const text = role?.trim();
  if (!text) return null;
  return (
    <span className={styles.badge} title={text}>
      {text}
    </span>
  );
}

// 運営アカウントのバッジ(サミットの投稿者名の上。2026/10/20)。admin_users.board_official のアカウントだけ。
export function OfficialBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className={`${styles.badge} ${styles.official}`} title="Poker Summit運営">
      運営
    </span>
  );
}
