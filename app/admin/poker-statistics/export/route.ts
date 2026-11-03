import {loadPokerStatistics} from '@/lib/poker/statistics';
import {statisticsCSV} from '@/lib/poker/statistics-csv';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const type=new URL(request.url).searchParams.get('type');if(!['players','history','ring'].includes(type??''))return new Response('Invalid export',{status:400});
 const data=await loadPokerStatistics(true);if(!data)return new Response('Forbidden or unavailable',{status:403,headers:{'Cache-Control':'no-store'}});
 const rows=type==='players'?[['表示名','参加大会数','1位回数','2位回数','3位回数','集計日時'],...data.players.map(p=>[p.name,p.played,p.firsts,p.seconds,p.thirds,data.asOf])]:type==='ring'?[['表示名','順位','残高','持ち込み中','合計','集計日時'],...data.ring.map(p=>[p.name,p.position,p.available,p.in_play,p.total,data.asOf])]:[['大会名','終了日時','表示名','順位','同率範囲末尾','集計日時'],...data.history.map(p=>[p.title,p.finished_at,p.row.name,p.row.place,p.row.tiedThrough,data.asOf])];
 return new Response(statisticsCSV(rows),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="poker-${type}.csv"`,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});
}
