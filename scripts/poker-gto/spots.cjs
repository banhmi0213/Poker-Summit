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
