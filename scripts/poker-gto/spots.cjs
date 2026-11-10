// Postflop spots precomputed for the flop browser (2026/10/27). Ranges are standard reference ranges for 100BB
// 6-max (not a preflop solve); they are written into every result so the page can show them.
// oop = first to act after the flop.
// Bet menus (version 3, 2026/10/29): three flop sizes, and a raise on every street (before, the turn and river had none,
// which let bets go unpunished). The river keeps no average strategy (riverCurrentOnly) so the trees fit in memory.
const SRP={betSizes:[0.33,0.66,1.25],raiseSizes:[3],maxRaises:1,turnBetSizes:[0.66],turnRaiseSizes:[3],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[3],riverMaxRaises:1,allinMaxPot:1.5};
const THREE_BET={betSizes:[0.33,0.66,1],raiseSizes:[2.5],maxRaises:1,turnBetSizes:[0.66],turnRaiseSizes:[2.5],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[2.5],riverMaxRaises:1,allinMaxPot:1.5};
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
 // ---- Preflop rebuild (2026/11/06): more single-raised and 3-bet pots, ranges from the chart ----
 'utg-hj':{name:'UTG対HJ・シングルレイズ・100BB',short:'UTGオープン→HJコール',pot:6.5,stack:97.5,oop:'UTG',ip:'HJ',sizes:SRP,note:'UTGがオープン、HJがコール。',oopRange:'22+,AJo+',ipRange:'22+,AJo+'},
 'utg-co':{name:'UTG対CO・シングルレイズ・100BB',short:'UTGオープン→COコール',pot:6.5,stack:97.5,oop:'UTG',ip:'CO',sizes:SRP,note:'UTGがオープン、COがコール。',oopRange:'22+,AJo+',ipRange:'22+,AJo+'},
 'hj-co':{name:'HJ対CO・シングルレイズ・100BB',short:'HJオープン→COコール',pot:6.5,stack:97.5,oop:'HJ',ip:'CO',sizes:SRP,note:'HJがオープン、COがコール。',oopRange:'22+,AJo+',ipRange:'22+,AJo+'},
 'hj-btn':{name:'HJ対BTN・シングルレイズ・100BB',short:'HJオープン→BTNコール',pot:6.5,stack:97.5,oop:'HJ',ip:'BTN',sizes:SRP,note:'HJがオープン、BTNがコール。',oopRange:'22+,AJo+',ipRange:'22+,AJo+'},
 'btn-sb':{name:'BTN対SB・シングルレイズ・100BB',short:'BTNオープン→SBコール',pot:6,stack:97.5,oop:'SB',ip:'BTN',sizes:SRP,note:'BTNがオープン、SBがコール、BBは降り。',oopRange:'22+,AJo+',ipRange:'22+,AJo+'},
 'hj-bb-3bet':{name:'HJ対BB・3ベットポット・100BB',short:'HJオープン→BBが3ベット→HJコール',pot:23,stack:89,oop:'BB',ip:'HJ',sizes:THREE_BET,note:'HJがオープン、BBが3ベット、HJがコール。',oopRange:'TT+,AKo',ipRange:'22+,AQo'},
 'sb-bb-3bet':{name:'SB対BB・3ベットポット・100BB',short:'SBオープン→BBが3ベット→SBコール',pot:18,stack:91,oop:'SB',ip:'BB',sizes:THREE_BET,note:'SBがオープン、BBが3ベット、SBがコール。',oopRange:'22+,AQo',ipRange:'TT+,AKo'},
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
 'btn-bb-4bet':{name:'BTN対BB・4ベットポット・100BB',short:'BBが3ベット→BTNが4ベット→BBコール',pot:50.5,stack:75,oop:'BB',ip:'BTN',sizes:{betSizes:[0.25,0.5],raiseSizes:[],maxRaises:1,turnBetSizes:[0.5],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5},
  note:'BTNが2.5BBでオープン、BBが11BBに3ベット、BTNが25BBに4ベット、BBがコール（ポット50.5BB）。',
  oopRange:'TT-QQ,AQs,AKo,AJs,KQs,A5s',
  ipRange:'QQ+,AKs,AKo,A5s,A4s,KJs'},
};

// Preflop line of each spot in the chart (2026/10/27). flop-solve.cjs takes ranges, pot and stack from the chart along
// this line (scripts/poker-gto/chart-ranges.cjs); the reference ranges above remain only for the page text.
const LINES={'btn-bb':'UTGF HJF COF BTN2.5 SBF BBC','co-bb':'UTGF HJF CO2.5 BTNF SBF BBC','hj-bb':'UTGF HJ2.5 COF BTNF SBF BBC',
 'utg-bb':'UTG2.5 HJF COF BTNF SBF BBC','sb-bb':'UTGF HJF COF BTNF SB3 BBC','co-btn':'UTGF HJF CO2.5 BTNC','utg-btn':'UTG2.5 HJF COF BTNC',
 'utg-hj':'UTG2.5 HJC','utg-co':'UTG2.5 HJF COC','hj-co':'UTGF HJ2.5 COC','hj-btn':'UTGF HJ2.5 COF BTNC','btn-sb':'UTGF HJF COF BTN2.5 SBC BBF','hj-bb-3bet':'UTGF HJ2.5 COF BTNF SBF BB11 HJC','sb-bb-3bet':'UTGF HJF COF BTNF SB3 BB9 SBC',
 'btn-bb-3bet':'UTGF HJF COF BTN2.5 SBF BB11 BTNC','co-bb-3bet':'UTGF HJF CO2.5 BTNF SBF BB11 COC','utg-bb-3bet':'UTG2.5 HJF COF BTNF SBF BB11 UTGC',
 'btn-sb-3bet':'UTGF HJF COF BTN2.5 SB11 BTNC','co-btn-3bet':'UTGF HJF CO2.5 BTN7.5 COC','btn-bb-4bet':'UTGF HJF COF BTN2.5 SBF BB11 BTN24.2 BBC'};
for(const [id,line] of Object.entries(LINES))if(module.exports[id])module.exports[id].line=line;

// ---- Small blind limps (2026/10/29): folded to the SB, it limps; SB acts first after the flop. ----
Object.assign(module.exports,{
 'sb-limp':{name:'SB対BB・リンプポット・100BB',short:'SBリンプ→BBチェック',pot:2,stack:99,oop:'SB',ip:'BB',sizes:SRP,line:'UTGF HJF COF BTNF SBC BBC',
  note:'SBまで全員降りて、SBがリンプ、BBがチェック（ポット2BB）。SBが先に打つ。',oopRange:'プリフロップ表のSBのリンプ',ipRange:'プリフロップ表のBBのチェック'},
 'sb-iso':{name:'SB対BB・リンプ後のレイズ・100BB',short:'SBリンプ→BBレイズ→SBコール',pot:8,stack:96,oop:'SB',ip:'BB',sizes:SRP,line:'UTGF HJF COF BTNF SBC BB4 SBC',
  note:'SBがリンプ、BBが4BBにレイズ、SBがコール（ポット8BB）。SBが先に打つ。',oopRange:'プリフロップ表のSBのコール',ipRange:'プリフロップ表のBBのレイズ'},
});

// ---- Three-way pots (2026/10/29): open, a call and the big blind's call. Solved on the flop only (scripts/poker-gto/
// multiway-solve.cjs); after the flop the pot is shared by equity over the runouts. `order` = postflop order. ----
const MW={betSizes:[0.33,0.66,1.25],raiseSizes:[3],maxRaises:1,allinMaxPot:1.5};
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
const HU_LIMP=SRP;
Object.assign(module.exports,{
 'hu-srp':{name:'2人・SB（ボタン）オープン対BB・100BB',short:'SBオープン→BBコール（2人）',pot:5,stack:97.5,oop:'BB',ip:'SB',sizes:SRP,chart:'hu',line:'SB2.5 BBC',
  note:'2人のとき。SB（ボタン）が2.5BBでオープン、BBがコール（ポット5BB）。BBが先に打つ。',oopRange:'2人用プリフロップ表のBBのコール',ipRange:'2人用プリフロップ表のSBのオープン'},
 'hu-limp':{name:'2人・リンプポット・100BB',short:'SBリンプ→BBチェック（2人）',pot:2,stack:99,oop:'BB',ip:'SB',sizes:HU_LIMP,chart:'hu',line:'SBC BBC',
  note:'2人のとき。SB（ボタン）がリンプ、BBがチェック（ポット2BB）。BBが先に打つ。',oopRange:'2人用プリフロップ表のBBのチェック',ipRange:'2人用プリフロップ表のSBのリンプ'},
 'hu-3bet':{name:'2人・3ベットポット・100BB',short:'SBオープン→BB3ベット→SBコール（2人）',pot:20,stack:90,oop:'BB',ip:'SB',sizes:THREE_BET,chart:'hu',line:'SB2.5 BB10 SBC',
  note:'2人のとき。SBが2.5BBでオープン、BBが10BBに3ベット、SBがコール（ポット20BB）。BBが先に打つ。',oopRange:'2人用プリフロップ表のBBの3ベット',ipRange:'2人用プリフロップ表のSBのコール'},
});

// ---- Pots the postflop table lacked (2026/11/09): without solved flops the preflop chart valued them with a rough
// formula, which made 4-bets look bad and 3-bets almost free. Ranges come from the rebuild chart (chart 'r4'). ----
{const R4={pot:0,stack:0,chart:'r4',flopCount:6,oopRange:'プリフロップ表から',ipRange:'プリフロップ表から'};
 const FOUR_BET={betSizes:[0.25,0.5],raiseSizes:[],maxRaises:1,turnBetSizes:[0.5],turnRaiseSizes:[],turnMaxRaises:1,riverBetSizes:[0.75],riverRaiseSizes:[],riverMaxRaises:1,allinMaxPot:1.5};
 const add=(id,name,oop,ip,sizes,line)=>{module.exports[id]={...R4,name,short:name,note:name+'（再構築用）',oop,ip,sizes,line};};
 // single-raised pots, SB flats
 add('utg-sb','UTGオープン→SBコール','SB','UTG',SRP,'UTG2.5 HJF COF BTNF SBC BBF');
 add('hj-sb','HJオープン→SBコール','SB','HJ',SRP,'UTGF HJ2.5 COF BTNF SBC BBF');
 add('co-sb','COオープン→SBコール','SB','CO',SRP,'UTGF HJF CO2.5 BTNF SBC BBF');
 // 3-bet pots
 add('utg-sb-3bet','UTGオープン→SBが3ベット→UTGコール','SB','UTG',THREE_BET,'UTG2.5 HJF COF BTNF SB11.5 UTGC');
 add('hj-sb-3bet','HJオープン→SBが3ベット→HJコール','SB','HJ',THREE_BET,'UTGF HJ2.5 COF BTNF SB11.5 HJC');
 add('co-sb-3bet','COオープン→SBが3ベット→COコール','SB','CO',THREE_BET,'UTGF HJF CO2.5 BTNF SB11.5 COC');
 add('utg-btn-3bet','UTGオープン→BTNが3ベット→UTGコール','UTG','BTN',THREE_BET,'UTG2.5 HJF COF BTN8.5 UTGC');
 add('hj-btn-3bet','HJオープン→BTNが3ベット→HJコール','HJ','BTN',THREE_BET,'UTGF HJ2.5 COF BTN8.5 HJC');
 add('utg-co-3bet','UTGオープン→COが3ベット→UTGコール','UTG','CO',THREE_BET,'UTG2.5 HJF CO8.5 UTGC');
 add('hj-co-3bet','HJオープン→COが3ベット→HJコール','HJ','CO',THREE_BET,'UTGF HJ2.5 CO8.5 HJC');
 // 4-bet pots (opener 4-bets, the 3-bettor calls)
 add('co-bb-4bet','COオープン→BB3ベット→CO4ベット→BBコール','BB','CO',FOUR_BET,'UTGF HJF CO2.5 BTNF SBF BB13 CO27.6 BBC');
 add('co-sb-4bet','COオープン→SB3ベット→CO4ベット→SBコール','SB','CO',FOUR_BET,'UTGF HJF CO2.5 BTNF SB11.5 CO24.4 SBC');
 add('co-btn-4bet','COオープン→BTN3ベット→CO4ベット→BTNコール','CO','BTN',FOUR_BET,'UTGF HJF CO2.5 BTN8.5 CO23 BTNC');
 add('btn-sb-4bet','BTNオープン→SB3ベット→BTN4ベット→SBコール','SB','BTN',FOUR_BET,'UTGF HJF COF BTN2.5 SB11.5 BTN24.4 SBC');
 add('hj-bb-4bet','HJオープン→BB3ベット→HJ4ベット→BBコール','BB','HJ',FOUR_BET,'UTGF HJ2.5 COF BTNF SBF BB12.5 HJ26.5 BBC');
 add('hj-sb-4bet','HJオープン→SB3ベット→HJ4ベット→SBコール','SB','HJ',FOUR_BET,'UTGF HJ2.5 COF BTNF SB11.5 HJ24.4 SBC');
 add('hj-btn-4bet','HJオープン→BTN3ベット→HJ4ベット→BTNコール','HJ','BTN',FOUR_BET,'UTGF HJ2.5 COF BTN8.5 HJ23 BTNC');
 add('hj-co-4bet','HJオープン→CO3ベット→HJ4ベット→COコール','HJ','CO',FOUR_BET,'UTGF HJ2.5 CO8.5 HJ23 COC');
 add('utg-sb-4bet','UTGオープン→SB3ベット→UTG4ベット→SBコール','SB','UTG',FOUR_BET,'UTG2.5 HJF COF BTNF SB11.5 UTG24.4 SBC');
 add('utg-btn-4bet','UTGオープン→BTN3ベット→UTG4ベット→BTNコール','UTG','BTN',FOUR_BET,'UTG2.5 HJF COF BTN8.5 UTG23 BTNC');
 add('utg-co-4bet','UTGオープン→CO3ベット→UTG4ベット→COコール','UTG','CO',FOUR_BET,'UTG2.5 HJF CO8.5 UTG23 COC');
}

// ---- Range-consistent re-solve, iteration 1 (2026/11/10): every two-player pot again, with the ranges and bet sizes of
// the current preflop chart ('it1'), so the postflop values match the ranges the preflop solve actually plays. ----
{const IT1={"btn-bb":"UTGF HJF COF BTN2.5 SBF BBC","co-bb":"UTGF HJF CO2.5 BTNF SBF BBC","sb-bb":"UTGF HJF COF BTNF SB3.5 BBC","btn-bb-3bet":"UTGF HJF COF BTN2.5 SBF BB13 BTNC","utg-bb":"UTG2.5 HJF COF BTNF SBF BBC","hj-bb":"UTGF HJ2.5 COF BTNF SBF BBC","co-btn":"UTGF HJF CO2.5 BTNC","utg-btn":"UTG2.5 HJF COF BTNC","utg-hj":"UTG2.5 HJC","utg-co":"UTG2.5 HJF COC","hj-co":"UTGF HJ2.5 COC","hj-btn":"UTGF HJ2.5 COF BTNC","btn-sb":"UTGF HJF COF BTN2.5 SBC BBF","hj-bb-3bet":"UTGF HJ2.5 COF BTNF SBF BB12.5 HJC","sb-bb-3bet":"UTGF HJF COF BTNF SB3.5 BB10.5 SBC","co-bb-3bet":"UTGF HJF CO2.5 BTNF SBF BB13 COC","btn-sb-3bet":"UTGF HJF COF BTN2.5 SB11.5 BTNC","co-btn-3bet":"UTGF HJF CO2.5 BTN8.5 COC","utg-bb-3bet":"UTG2.5 HJF COF BTNF SBF BB12.5 UTGC","btn-bb-4bet":"UTGF HJF COF BTN2.5 SBF BB13 BTN27.6 BBC","sb-limp":"UTGF HJF COF BTNF SBC BBC","sb-iso":"UTGF HJF COF BTNF SBC BB4 SBC","utg-sb":"UTG2.5 HJF COF BTNF SBC BBF","hj-sb":"UTGF HJ2.5 COF BTNF SBC BBF","co-sb":"UTGF HJF CO2.5 BTNF SBC BBF","utg-sb-3bet":"UTG2.5 HJF COF BTNF SB11.5 UTGC","hj-sb-3bet":"UTGF HJ2.5 COF BTNF SB11.5 HJC","co-sb-3bet":"UTGF HJF CO2.5 BTNF SB11.5 COC","utg-btn-3bet":"UTG2.5 HJF COF BTN8.5 UTGC","hj-btn-3bet":"UTGF HJ2.5 COF BTN8.5 HJC","utg-co-3bet":"UTG2.5 HJF CO8.5 UTGC","hj-co-3bet":"UTGF HJ2.5 CO8.5 HJC","co-bb-4bet":"UTGF HJF CO2.5 BTNF SBF BB13 CO27.6 BBC","co-sb-4bet":"UTGF HJF CO2.5 BTNF SB11.5 CO24.4 SBC","co-btn-4bet":"UTGF HJF CO2.5 BTN8.5 CO23 BTNC","btn-sb-4bet":"UTGF HJF COF BTN2.5 SB11.5 BTN24.4 SBC","hj-bb-4bet":"UTGF HJ2.5 COF BTNF SBF BB12.5 HJ26.5 BBC","hj-sb-4bet":"UTGF HJ2.5 COF BTNF SB11.5 HJ24.4 SBC","hj-btn-4bet":"UTGF HJ2.5 COF BTN8.5 HJ23 BTNC","hj-co-4bet":"UTGF HJ2.5 CO8.5 HJ23 COC","utg-sb-4bet":"UTG2.5 HJF COF BTNF SB11.5 UTG24.4 SBC","utg-btn-4bet":"UTG2.5 HJF COF BTN8.5 UTG23 BTNC","utg-co-4bet":"UTG2.5 HJF CO8.5 UTG23 COC"};
 for(const [id,line] of Object.entries(IT1)){const s=module.exports[id];module.exports['i1-'+id]={pot:0,stack:0,chart:'it1',flopCount:6,name:s.name+'（再計算1）',short:s.short,
  note:s.short+'（再計算1）',oop:s.oop,ip:s.ip,sizes:s.sizes,oopRange:'プリフロップ表から',ipRange:'プリフロップ表から',line};}
 module.exports['i1-test']={...module.exports['i1-btn-bb-3bet'],flopCount:1};
 // Iteration 2 (2026/11/11): same lines, ranges from chart-it2 (half it1, half the preflop solved from the it1 flops). Run with a lite tag (3 boards).
 for(const id of Object.keys(IT1)){const s=module.exports['i1-'+id];module.exports['i2-'+id]={...s,chart:'it2',flopCount:3,name:s.name.replace('（再計算1）','（再計算2）'),note:s.note.replace('（再計算1）','（再計算2）')};}}
