/** What プロ gains during the スタート記念価格 period (GTO chat 2026/11/01). The GTO chat edits this list:
 * set `done:true` (and optionally `doneAt`) when an item ships. The pricing page, the player page notice and the
 * 2027-02-01 / 2027-02-22 emails read it. If an item cannot ship by 2027-03-01, talk about moving the price date. */
export type RoadmapItem={label:string;done:boolean;doneAt?:string};
export const PRO_ROADMAP:readonly RoadmapItem[]=[
 {label:'8〜9人卓のフロップ戦略',done:false},
 {label:'大会の振り返りにICM',done:false},
 {label:'ポストフロップのベット額を増やした計算データ',done:false},
 {label:'「改良中」の場面（SBのリンプ・スクイーズ・3人のポット）の対応',done:false},
];
export const PRO_ROADMAP_INTRO='スタート記念価格のあいだに、次の内容を順番に追加します：';
/** The exact one-line form used on /pricing. */
export const proRoadmapLine=()=>PRO_ROADMAP_INTRO+PRO_ROADMAP.map(i=>i.label).join('／');
