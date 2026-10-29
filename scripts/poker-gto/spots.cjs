// Postflop spots precomputed for the flop browser (2026/10/27). Ranges are standard reference ranges for 100BB
// 6-max (not a preflop solve); they are written into every result so the page can show them.
// oop = first to act after the flop.
const SRP={betSizes:[0.33,0.75],raiseSizes:[3],maxRaises:1,turnBetSizes:[0.66],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5};
const THREE_BET={betSizes:[0.33,0.66],raiseSizes:[2.5],maxRaises:1,turnBetSizes:[0.66],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5};
module.exports={
 'btn-bb':{name:'BTN対BB・シングルレイズ・100BB',short:'BTNオープン→BBコール',pot:5.5,stack:97.5,oop:'BB',ip:'BTN',sizes:SRP,
  note:'BTNが2.5BBでオープン、BBがコール（ポット5.5BB）。',
  oopRange:'22+,A2s+,K2s+,Q2s+,J2s+,T4s+,95s+,84s+,74s+,63s+,53s+,43s,A2o+,K5o+,Q7o+,J7o+,T7o+,97o+,86o+,76o,65o',oopExclude:'QQ+,AKs,AKo,A5s,A4s',
  ipRange:'22+,A2s+,K2s+,Q2s+,J4s+,T6s+,96s+,85s+,75s+,64s+,54s,A2o+,K8o+,Q9o+,J9o+,T8o+,98o,87o'},
 'co-bb':{name:'CO対BB・シングルレイズ・100BB',short:'COオープン→BBコール',pot:5.5,stack:97.5,oop:'BB',ip:'CO',sizes:SRP,
  note:'COが2.5BBでオープン、BBがコール（ポット5.5BB）。',
  oopRange:'22+,A2s+,K2s+,Q5s+,J6s+,T6s+,96s+,85s+,75s+,64s+,54s,A7o+,KTo+,QTo+,JTo,T9o',oopExclude:'QQ+,AKs,AKo,AQs,A5s',
  ipRange:'22+,A2s+,K6s+,Q8s+,J8s+,T7s+,97s+,86s+,76s,65s,54s,A9o+,KTo+,QTo+,JTo'},
 'sb-bb':{name:'SB対BB・シングルレイズ・100BB',short:'SBオープン→BBコール',pot:6,stack:97,oop:'SB',ip:'BB',sizes:SRP,
  note:'SBが3BBでオープン、BBがコール（ポット6BB）。SBが先に打つ。',
  oopRange:'22+,A2s+,K2s+,Q4s+,J6s+,T6s+,96s+,85s+,75s+,64s+,54s,A2o+,K7o+,Q9o+,J9o+,T9o',
  ipRange:'22+,A2s+,K2s+,Q2s+,J4s+,T6s+,96s+,85s+,75s+,64s+,54s,A2o+,K7o+,Q8o+,J8o+,T8o+,98o',ipExclude:'QQ+,AKs,AKo,A5s,A4s'},
 'btn-bb-3bet':{name:'BTN対BB・3ベットポット・100BB',short:'BBが3ベット→BTNコール',pot:22.5,stack:89,oop:'BB',ip:'BTN',sizes:THREE_BET,
  note:'BTNが2.5BBでオープン、BBが11BBに3ベット、BTNがコール（ポット22.5BB）。',
  oopRange:'TT+,AJs+,KQs,A5s,A4s,A3s,K9s,Q9s,J9s,T8s,98s,76s,65s,AQo+',
  ipRange:'22+,ATs+,KTs+,QTs+,JTs,T9s,98s,87s,76s,65s,A5s,A4s,AJo+,KQo',ipExclude:'QQ+,AKs,AKo'},

 // ---- More single-raised pots (BB defends) ----
 'utg-bb':{name:'UTG対BB・シングルレイズ・100BB',short:'UTGオープン→BBコール',pot:5.5,stack:97.5,oop:'BB',ip:'UTG',sizes:SRP,
  note:'UTGが2.5BBでオープン、BBがコール（ポット5.5BB）。',
  oopRange:'22+,A2s+,K6s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,65s,54s,ATo+,KJo+,QJo',oopExclude:'QQ+,AKs,AKo,A5s',
  ipRange:'22+,A3s+,K9s+,QTs+,JTs,T9s,98s,87s,76s,65s,AJo+,KQo'},
 'hj-bb':{name:'HJ対BB・シングルレイズ・100BB',short:'HJオープン→BBコール',pot:5.5,stack:97.5,oop:'BB',ip:'HJ',sizes:SRP,
  note:'HJが2.5BBでオープン、BBがコール（ポット5.5BB）。',
  oopRange:'22+,A2s+,K4s+,Q7s+,J7s+,T7s+,96s+,86s+,75s+,64s+,54s,A9o+,KTo+,QTo+,JTo',oopExclude:'QQ+,AKs,AKo,AQs,A5s',
  ipRange:'22+,A2s+,K8s+,Q9s+,J9s+,T8s+,98s,87s,76s,65s,ATo+,KJo+,QJo'},
 // ---- In position cold calls ----
 'co-btn':{name:'CO対BTN・シングルレイズ・100BB',short:'COオープン→BTNコール',pot:6.5,stack:97.5,oop:'CO',ip:'BTN',sizes:SRP,
  note:'COが2.5BBでオープン、BTNがコール、ブラインドは降り（ポット6.5BB）。COが先に打つ。',
  oopRange:'22+,A2s+,K6s+,Q8s+,J8s+,T7s+,97s+,86s+,76s,65s,54s,A9o+,KTo+,QTo+,JTo',
  ipRange:'22-JJ,A9s-AQs,KTs+,QTs+,JTs,T9s,98s,87s,76s,65s,AJo-AQo,KQo'},
 'utg-btn':{name:'UTG対BTN・シングルレイズ・100BB',short:'UTGオープン→BTNコール',pot:6.5,stack:97.5,oop:'UTG',ip:'BTN',sizes:SRP,
  note:'UTGが2.5BBでオープン、BTNがコール、ブラインドは降り（ポット6.5BB）。UTGが先に打つ。',
  oopRange:'22+,A3s+,K9s+,QTs+,JTs,T9s,98s,87s,76s,65s,AJo+,KQo',
  ipRange:'22-JJ,ATs-AQs,KJs+,QJs,JTs,T9s,98s,AQo'},
 // ---- More 3-bet pots ----
 'co-bb-3bet':{name:'CO対BB・3ベットポット・100BB',short:'COオープン→BBが3ベット→COコール',pot:22.5,stack:89,oop:'BB',ip:'CO',sizes:THREE_BET,
  note:'COが2.5BBでオープン、BBが11BBに3ベット、COがコール（ポット22.5BB）。',
  oopRange:'TT+,AQs+,KQs,A5s,A4s,K9s,Q9s,J9s,T8s,76s,65s,AKo',
  ipRange:'22+,ATs+,KTs+,QTs+,JTs,T9s,98s,87s,76s,A5s,AQo,KQo',ipExclude:'QQ+,AKs,AKo'},
 'btn-sb-3bet':{name:'BTN対SB・3ベットポット・100BB',short:'BTNオープン→SBが3ベット→BTNコール',pot:23,stack:89,oop:'SB',ip:'BTN',sizes:THREE_BET,
  note:'BTNが2.5BBでオープン、SBが11BBに3ベット、BTNがコール、BBは降り（ポット23BB）。',
  oopRange:'99+,ATs+,KTs+,QTs+,JTs,T9s,A5s,A4s,A3s,K9s,98s,87s,76s,65s,AJo+,KQo',
  ipRange:'22+,A9s+,KTs+,QTs+,JTs,T9s,98s,87s,76s,65s,ATo+,KJo+',ipExclude:'QQ+,AKs,AKo'},
 'co-btn-3bet':{name:'CO対BTN・3ベットポット・100BB（BTNが3ベット）',short:'COオープン→BTNが3ベット→COコール',pot:23.5,stack:89,oop:'CO',ip:'BTN',sizes:THREE_BET,
  note:'COが2.5BBでオープン、BTNが11BBに3ベット、COがコール、ブラインドは降り（ポット23.5BB）。COが先に打つ。',
  oopRange:'22+,ATs+,KTs+,QTs+,JTs,T9s,98s,87s,76s,A5s,A4s,AQo,KQo',oopExclude:'QQ+,AKs,AKo',
  ipRange:'TT+,AQs+,KQs,A5s,A4s,A3s,K9s,Q9s,J9s,T8s,98s,76s,65s,AKo'},
 'utg-bb-3bet':{name:'UTG対BB・3ベットポット・100BB',short:'UTGオープン→BBが3ベット→UTGコール',pot:24.5,stack:88,oop:'BB',ip:'UTG',sizes:THREE_BET,
  note:'UTGが2.5BBでオープン、BBが12BBに3ベット、UTGがコール（ポット24.5BB）。',
  oopRange:'JJ+,AQs+,KQs,A5s,A4s,AKo',
  ipRange:'22+,ATs+,KJs+,QJs,JTs,T9s,98s,87s,AQo+',ipExclude:'KK+,AKs'},
 // ---- 4-bet pot ----
 'btn-bb-4bet':{name:'BTN対BB・4ベットポット・100BB',short:'BBが3ベット→BTNが4ベット→BBコール',pot:50.5,stack:75,oop:'BB',ip:'BTN',sizes:{betSizes:[0.33],raiseSizes:[],maxRaises:1,turnBetSizes:[0.5],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5},
  note:'BTNが2.5BBでオープン、BBが11BBに3ベット、BTNが25BBに4ベット、BBがコール（ポット50.5BB）。',
  oopRange:'TT-QQ,AQs,AKo,AJs,KQs,A5s',
  ipRange:'QQ+,AKs,AKo,A5s,A4s,KJs'},
};

// Preflop line of each spot in the chart (2026/10/27). flop-solve.cjs takes ranges, pot and stack from the chart along
// this line (scripts/poker-gto/chart-ranges.cjs); the reference ranges above remain only for the page text.
const LINES={'btn-bb':'UTGF HJF COF BTN2.5 SBF BBC','co-bb':'UTGF HJF CO2.5 BTNF SBF BBC','hj-bb':'UTGF HJ2.5 COF BTNF SBF BBC',
 'utg-bb':'UTG2.5 HJF COF BTNF SBF BBC','sb-bb':'UTGF HJF COF BTNF SB3 BBC','co-btn':'UTGF HJF CO2.5 BTNC','utg-btn':'UTG2.5 HJF COF BTNC',
 'btn-bb-3bet':'UTGF HJF COF BTN2.5 SBF BB11 BTNC','co-bb-3bet':'UTGF HJF CO2.5 BTNF SBF BB11 COC','utg-bb-3bet':'UTG2.5 HJF COF BTNF SBF BB11 UTGC',
 'btn-sb-3bet':'UTGF HJF COF BTN2.5 SB11 BTNC','co-btn-3bet':'UTGF HJF CO2.5 BTN7.5 COC','btn-bb-4bet':'UTGF HJF COF BTN2.5 SBF BB11 BTN24.2 BBC'};
for(const [id,line] of Object.entries(LINES))if(module.exports[id])module.exports[id].line=line;

// ---- Small blind limps (2026/10/29): folded to the SB, it limps; SB acts first after the flop. ----
Object.assign(module.exports,{
 'sb-limp':{name:'SB対BB・リンプポット・100BB',short:'SBリンプ→BBチェック',pot:2,stack:99,oop:'SB',ip:'BB',sizes:{betSizes:[0.5,1],raiseSizes:[3],maxRaises:1,turnBetSizes:[0.66],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5},line:'UTGF HJF COF BTNF SBC BBC',
  note:'SBまで全員降りて、SBがリンプ、BBがチェック（ポット2BB）。SBが先に打つ。',oopRange:'プリフロップ表のSBのリンプ',ipRange:'プリフロップ表のBBのチェック'},
 'sb-iso':{name:'SB対BB・リンプ後のレイズ・100BB',short:'SBリンプ→BBレイズ→SBコール',pot:8,stack:96,oop:'SB',ip:'BB',sizes:SRP,line:'UTGF HJF COF BTNF SBC BB4 SBC',
  note:'SBがリンプ、BBが4BBにレイズ、SBがコール（ポット8BB）。SBが先に打つ。',oopRange:'プリフロップ表のSBのコール',ipRange:'プリフロップ表のBBのレイズ'},
});

// ---- Three-way pots (2026/10/29): open, a call and the big blind's call. Solved on the flop only (scripts/poker-gto/
// multiway-solve.cjs); after the flop the pot is shared by equity over the runouts. `order` = postflop order. ----
const MW={betSizes:[0.33,0.75],raiseSizes:[3],maxRaises:1,allinMaxPot:1.5};
Object.assign(module.exports,{
 'co-btn-bb':{name:'3人・COオープン→BTNコール→BBコール・100BB',short:'CO・BTN・BBの3人',players:3,order:['BB','CO','BTN'],sizes:MW,line:'UTGF HJF CO2.5 BTNC SBF BBC',
  note:'COが2.5BBでオープン、BTNとBBがコール（ポット8BB）。BB→CO→BTNの順に打つ。'},
 'btn-sb-bb':{name:'3人・BTNオープン→SBコール→BBコール・100BB',short:'BTN・SB・BBの3人',players:3,order:['SB','BB','BTN'],sizes:MW,line:'UTGF HJF COF BTN2.5 SBC BBC',
  note:'BTNが2.5BBでオープン、SBとBBがコール（ポット7.5BB）。SB→BB→BTNの順に打つ。'},
 'utg-btn-bb':{name:'3人・UTGオープン→BTNコール→BBコール・100BB',short:'UTG・BTN・BBの3人',players:3,order:['BB','UTG','BTN'],sizes:MW,line:'UTG2.5 HJF COF BTNC SBF BBC',
  note:'UTGが2.5BBでオープン、BTNとBBがコール（ポット8BB）。BB→UTG→BTNの順に打つ。'},
});

// ---- Heads-up (2026/10/29): two players dealt in, the button is the SB and acts last after the flop. Ranges from
// preflop-hu.json along each line; the reference ranges are only for the page text. ----
const HU_LIMP={betSizes:[0.5,1],raiseSizes:[3],maxRaises:1,turnBetSizes:[0.66],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5};
Object.assign(module.exports,{
 'hu-srp':{name:'2人・SB（ボタン）オープン対BB・100BB',short:'SBオープン→BBコール（2人）',pot:5,stack:97.5,oop:'BB',ip:'SB',sizes:SRP,chart:'hu',line:'SB2.5 BBC',
  note:'2人のとき。SB（ボタン）が2.5BBでオープン、BBがコール（ポット5BB）。BBが先に打つ。',oopRange:'2人用プリフロップ表のBBのコール',ipRange:'2人用プリフロップ表のSBのオープン'},
 'hu-limp':{name:'2人・リンプポット・100BB',short:'SBリンプ→BBチェック（2人）',pot:2,stack:99,oop:'BB',ip:'SB',sizes:HU_LIMP,chart:'hu',line:'SBC BBC',
  note:'2人のとき。SB（ボタン）がリンプ、BBがチェック（ポット2BB）。BBが先に打つ。',oopRange:'2人用プリフロップ表のBBのチェック',ipRange:'2人用プリフロップ表のSBのリンプ'},
 'hu-3bet':{name:'2人・3ベットポット・100BB',short:'SBオープン→BB3ベット→SBコール（2人）',pot:20,stack:90,oop:'BB',ip:'SB',sizes:THREE_BET,chart:'hu',line:'SB2.5 BB10 SBC',
  note:'2人のとき。SBが2.5BBでオープン、BBが10BBに3ベット、SBがコール（ポット20BB）。BBが先に打つ。',oopRange:'2人用プリフロップ表のBBの3ベット',ipRange:'2人用プリフロップ表のSBのコール'},
});
