// サミット(掲示板)やマイページで使う丸いアイコン表示の共通部品
// (2026/10、「会員マイページにアイコンを設定できるようにして、投稿一覧の
// 丸いイニシャル表示の所に設定した画像が出るように」との指示)。
// これまでboard/page.tsxとboard/[id]/page.tsxにそれぞれ同じ
// avatarColor()とイニシャル表示のdivが重複していたので、ここに集約し、
// avatar_url(profilesテーブルからuser_idで引いた値)があれば画像、なければ
// 従来通り名前の頭文字+名前から決まる色のイニシャル表示にフォールバックする。
const AVATAR_COLORS = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#1fae1f",
  "#9085e9",
  "#e66767",
];

export function avatarColor(name: string) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

export function Avatar({
  name,
  url,
  size,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const sizeStyle = size ? { width: size, height: size } : undefined;

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img loading="lazy" decoding="async" src={url} alt="" className="avatar" style={{ objectFit: "cover", ...sizeStyle }} />
    );
  }

  return (
    <div className="avatar" style={{ background: avatarColor(name), ...sizeStyle }}>
      {name.slice(0, 1)}
    </div>
  );
}
