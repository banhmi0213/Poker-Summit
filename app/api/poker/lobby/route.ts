import {forwardPokerLobbyRequest} from '@/lib/poker/room-service-proxy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return forwardPokerLobbyRequest(request,process.env.POKER_ROOM_SERVICE_ORIGIN);}
