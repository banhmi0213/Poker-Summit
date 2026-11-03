import {forwardPokerRoomRequest} from '@/lib/poker/room-service-proxy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:{roomId:string}}){
 return forwardPokerRoomRequest(request,params.roomId,process.env.POKER_ROOM_SERVICE_ORIGIN);
}
