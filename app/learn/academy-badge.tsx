export function AcademyBadge({score,compact=false}:{score:number|null|undefined;compact?:boolean}){
 if(typeof score!=="number"||score<12)return null;
 return <span title={`初心者卒業テスト合格（最高${score}/15点）`} style={{display:"inline-flex",alignItems:"center",gap:4,padding:compact?"3px 7px":"5px 11px",border:"1px solid #d9b66f",borderRadius:20,background:"#fff4d8",color:"#795316",fontWeight:800,fontSize:compact?10:12,textDecoration:"none",whiteSpace:"nowrap"}}>🏅 {compact?"初心者卒業":"初心者コース卒業"} </span>;
}
