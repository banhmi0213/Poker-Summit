/** GTO plan comparison rows for /pricing. One place for the GTO chat to fill in.
 * Filled by the GTO chat (2026/11/1). 「順次追加」 rows come during the プロ スタート記念価格 period (until 2027/2/28).
 * Each cell is a short text: '○' / '—' / '1日5問' etc. */
export type FeatureRow={label:string;free:string;light:string;full:string;note?:string};
export const GTO_PLAN_FEATURES:readonly FeatureRow[]=[
 // GTO chat 2026/11/1. Columns: free = 無料, light = スタンダード, full = プロ (the plan names were changed by the owner).
 {label:'GTOと対戦・プリフロップ連打（6人卓）',free:'○',light:'○',full:'○'},
 {label:'プリフロップ表・フロップ戦略（6人卓）',free:'○',light:'○',full:'○'},
 {label:'GTO練習クイズ・毎日のクイズ',free:'○',light:'○',full:'○'},
 {label:'リバー・ICM・勝率・ポットオッズ計算機',free:'○',light:'○',full:'○'},
 {label:'あかんとこ一覧（全部の打ち場所のミスを損の大きい順に）',free:'上位3つ',light:'○',full:'○'},
 {label:'全ハンドのGTO振り返りとEV損失の集計',free:'直近の一部',light:'○',full:'○'},
 {label:'弱点ドリル（自分のミスの場面を集中して出題）（順次追加）',free:'—',light:'○',full:'○',note:'順次追加'},
 {label:'8〜9人卓のプリフロップ表（リング・レーキ別）（順次追加）',free:'—',light:'○',full:'○',note:'順次追加'},
 {label:'GTOと対戦の8〜9人卓（順次追加）',free:'—',light:'○',full:'○',note:'順次追加'},
 {label:'大会向けの表（8〜9人・60/40/20/10BB・アンティあり）（順次追加）',free:'—',light:'—',full:'○',note:'順次追加'},
 {label:'大会の振り返りにICM（順次追加）',free:'—',light:'—',full:'○',note:'順次追加'},
 {label:'8〜9人卓のフロップ戦略（順次追加）',free:'—',light:'—',full:'○',note:'順次追加'},
 {label:'ポストフロップのベット額を増やした計算データ（順次追加）',free:'—',light:'—',full:'○',note:'順次追加'},
];
/** Placeholder rows are shown with a note until the GTO chat finalises them. */
export const GTO_FEATURES_FINAL=true;
