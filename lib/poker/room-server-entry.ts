/** Runnable dedicated backend only. This entrypoint deliberately starts on execution. */
import {createConfiguredPokerRoomService} from './room-server';
import {runPokerRoomHost} from './room-host';
void runPokerRoomHost(()=>createConfiguredPokerRoomService(process.env),{
 on:(event,listener)=>process.on(event,listener),off:(event,listener)=>process.off(event,listener),
 log:event=>console.log(event),exit:code=>process.exit(code),
});
