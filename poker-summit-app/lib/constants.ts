export const CATEGORY_LABEL: Record<string, string> = {
  amusement: "アミューズメントポーカー",
  bar: "ポーカーバー",
  casino: "カジノバー",
  vip: "VIPルーム",
  mahjong: "麻雀併設",
  tournament: "トーナメント会場",
  school: "ポーカースクール",
  ladies: "レディース歓迎",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(
  ([value, label]) => ({ value, label })
);

export const CATEGORY_COLOR: Record<string, string> = {
  amusement: "#3987e5",
  bar: "#d95926",
  casino: "#199e70",
  school: "#c98500",
  tournament: "#d55181",
  mahjong: "#1fae1f",
  vip: "#9085e9",
  ladies: "#e66767",
};

export const CATEGORY_ICON: Record<string, string> = {
  amusement: "♠️",
  bar: "🍸",
  casino: "🎰",
  school: "🎓",
  tournament: "🏆",
  mahjong: "🀄",
  vip: "👑",
  ladies: "💎",
};

export const REGIONS = [
  "北海道・東北",
  "関東",
  "中部",
  "近畿",
  "中国",
  "四国",
  "九州・沖縄",
];

export const PREF_REGION: Record<string, string> = {
  北海道: "北海道・東北",
  青森県: "北海道・東北",
  岩手県: "北海道・東北",
  宮城県: "北海道・東北",
  秋田県: "北海道・東北",
  山形県: "北海道・東北",
  福島県: "北海道・東北",
  茨城県: "関東",
  栃木県: "関東",
  群馬県: "関東",
  埼玉県: "関東",
  千葉県: "関東",
  東京都: "関東",
  神奈川県: "関東",
  新潟県: "中部",
  富山県: "中部",
  石川県: "中部",
  福井県: "中部",
  山梨県: "中部",
  長野県: "中部",
  岐阜県: "中部",
  静岡県: "中部",
  愛知県: "中部",
  三重県: "近畿",
  滋賀県: "近畿",
  京都府: "近畿",
  大阪府: "近畿",
  兵庫県: "近畿",
  奈良県: "近畿",
  和歌山県: "近畿",
  鳥取県: "中国",
  島根県: "中国",
  岡山県: "中国",
  広島県: "中国",
  山口県: "中国",
  徳島県: "四国",
  香川県: "四国",
  愛媛県: "四国",
  高知県: "四国",
  福岡県: "九州・沖縄",
  佐賀県: "九州・沖縄",
  長崎県: "九州・沖縄",
  熊本県: "九州・沖縄",
  大分県: "九州・沖縄",
  宮崎県: "九州・沖縄",
  鹿児島県: "九州・沖縄",
  沖縄県: "九州・沖縄",
};

export const PREF_OPTIONS = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

export const JOB_TYPE_OPTIONS = [
  "正社員",
  "契約社員",
  "パート",
  "アルバイト",
  "業務委託",
];

export const BOARD_CATEGORIES = [
  "雑談",
  "初心者質問",
  "大会情報",
  "おすすめ店舗",
  "攻略・戦略",
];

export const EVENT_CATEGORIES = ["大会", "体験会", "講座", "交流会"];

export const INQUIRY_CATEGORIES = [
  "掲載について",
  "広告掲載について",
  "不具合報告",
  "その他",
];

export const STORE_STATUS_LABEL: Record<string, string> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
  listed: "掲載済み",
};
