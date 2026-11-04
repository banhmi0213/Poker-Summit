import {NextRequest,NextResponse} from 'next/server';
import {isUsageAdmin,loadUsage} from '@/lib/gto-usage-server';
import {usagePeriod,usageCsv,jstDay} from '@/lib/gto-usage';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(!await isUsageAdmin())return new NextResponse('Forbidden',{status:403});
 const q=req.nextUrl.searchParams,mode=q.get('mode')==='monthly'?'monthly':'daily',period=usagePeriod(mode,q.get(mode==='daily'?'date':'month')??undefined);
 try{const {report,startedAt}=await loadUsage(period);const pre=startedAt&&period.end<=Date.parse(jstDay(startedAt)+'T00:00:00+09:00');return new NextResponse(pre?'\uFEFF期間,状態\r\n'+period.value+',集計開始前':usageCsv(report,period),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="gto-usage-${period.value}.csv"`,'Cache-Control':'private, no-store'}});}catch{return new NextResponse('利用記録を読み込めませんでした。',{status:503});}
}
