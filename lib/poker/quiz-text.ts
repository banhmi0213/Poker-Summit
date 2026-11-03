/** Card code (rank×4 + suit c/d/h/s) as text, e.g. 「A♠」. */
export const quizCardText=(c:number)=>'23456789TJQKA'[c>>2]+'♣♦♥♠'[c&3];
export const quizCardRed=(c:number)=>(c&3)===1||(c&3)===2;
