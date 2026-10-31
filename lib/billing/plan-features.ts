/** GTO plan comparison rows for /pricing. One place for the GTO chat to fill in.
 * TODO(GTO chat): replace the placeholder rows with the real 無料／スタンダード／プロ contents before sales start.
 * Each cell is a short text: '○' / '—' / '1日5問' etc. */
export type FeatureRow={label:string;free:string;standard:string;pro:string;note?:string};
export const GTO_PLAN_FEATURES:readonly FeatureRow[]=[
 {label:'プリフロップ表',free:'一部',standard:'○',pro:'○',note:'仮の内容です（GTOチャットで確定）'},
 {label:'フロップ戦略',free:'一部',standard:'一部',pro:'○',note:'仮の内容です'},
 {label:'GTOと対戦',free:'お試し',standard:'○',pro:'○',note:'仮の内容です'},
 {label:'GTO練習クイズ',free:'1日5問',standard:'○',pro:'○',note:'仮の内容です'},
 {label:'ハンド履歴のGTO判定',free:'一部',standard:'○',pro:'○',note:'仮の内容です'},
 {label:'ICM・リバー・勝率計算機',free:'○',standard:'○',pro:'○'},
];
/** Placeholder rows are shown with a note until the GTO chat finalises them. */
export const GTO_FEATURES_FINAL=false;
