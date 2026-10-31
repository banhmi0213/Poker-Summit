import type {RingMonth} from '@/lib/poker/ring-monthly';
/** 月ごとの増減 (owner 2026/10/31: リセットされても増減数は各会員しっかりマイページに反映). */
export const CHIP_RESET_NOTICE='チップは毎月1日0時（日本時間）に、増えていても減っていても1,000にリセットされます。月ごとの増減はプレイヤーページに残ります。';
export function RingMonthlyView({rows}:{rows:RingMonth[]|null}){
 const label=(m:string)=>`${m.slice(0,4)}年${Number(m.slice(5))}月`;
 return <section aria-label="月ごとの増減" style={{marginTop:18}}>
  <h3>月ごとの増減</h3>
  <p>{CHIP_RESET_NOTICE}</p>
  {!rows?<p>月ごとの増減を取得できませんでした。</p>:!rows.length?<p>まだリングでのプレイ記録はありません。</p>:
  <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>月</th><th style={{textAlign:'right'}}>増減</th><th style={{textAlign:'right'}}>ハンド数</th><th style={{textAlign:'right'}}>月末の残高</th></tr></thead>
   <tbody>{rows.map(r=><tr key={r.month}><td>{label(r.month)}</td><td style={{textAlign:'right',fontWeight:700,color:r.net>0?'#3fbf7f':r.net<0?'#e0645f':undefined}}>{r.net>0?'+':''}{r.net.toLocaleString()}</td><td style={{textAlign:'right'}}>{r.hands.toLocaleString()}</td><td style={{textAlign:'right'}}>{r.endBalance===null?'集計中':r.endBalance.toLocaleString()}</td></tr>)}</tbody></table></div>}
 </section>;
}
