export const BOARD_REACTIONS = [
  { key: "helpful", emoji: "👍", label: "参考になった" },
  { key: "thanks", emoji: "🙏", label: "ありがとう" },
  { key: "nice", emoji: "🔥", label: "ナイスプレイ" },
  { key: "thinking", emoji: "🤔", label: "考えたい" },
] as const;
export type MentionMember = { user_id: string; display_name: string };
export type BoardReply = { id: string; post_id: string; body: string; author_name: string; author_user_id: string | null; created_at: string; image_url: string | null; parent_reply_id: string | null };
export type BoardReaction = { reply_id: string | null; total: number; mine: boolean; emoji: string };
export type ThreadPreference = { following: boolean; notifications_enabled: boolean };
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MENTION_PATTERN = /@\[([^\]\r\n]{1,80})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;
export function splitMentions(text: string) {
  const parts: { text: string; userId?: string }[] = [];
  let cursor = 0;
  for (const m of text.matchAll(new RegExp(MENTION_PATTERN))) {
    if (m.index! > cursor) parts.push({ text: text.slice(cursor, m.index) });
    parts.push({ text: `@${m[1]}`, userId: m[2] });
    cursor = m.index! + m[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
// Only candidates explicitly selected in the composer become notifications.
export function encodeMentions(text: string, members: MentionMember[]) {
  const sorted = [...members].sort((a, b) => b.display_name.length - a.display_name.length);
  const pattern = sorted.length ? new RegExp(`@(${sorted.map(m => m.display_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[\\s、。！？!?：:])`, "gu") : null;
  return pattern ? text.replace(pattern, (_, name) => {
    const m = sorted.find(x => x.display_name === name)!;
    return `@[${m.display_name}](${m.user_id})`;
  }) : text;
}
