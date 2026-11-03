/** Explicit host lifecycle. Logs contain fixed events, never configuration/errors. */
type Service={start:()=>Promise<unknown>;close:()=>Promise<void>};
type Host={on:(event:string,listener:()=>void)=>unknown;off:(event:string,listener:()=>void)=>unknown;exit:(code:number)=>void;log:(event:string)=>void};
export async function runPokerRoomHost(create:()=>Service,host:Host,shutdownMs=15000){
 let service:Service|undefined,stopping=false,failed=false,timer:ReturnType<typeof setTimeout>|undefined;
 const cleanup=()=>{host.off('SIGTERM',stop);host.off('SIGINT',stop);if(timer)clearTimeout(timer);};
 const stop=()=>{if(stopping)return;stopping=true;host.log('poker_server_stopping');
  timer=setTimeout(()=>{cleanup();host.log('poker_server_shutdown_timeout');host.exit(1);},shutdownMs);
  void Promise.resolve().then(()=>service?.close()).then(()=>{cleanup();host.log('poker_server_stopped');host.exit(failed?1:0);},()=>{cleanup();host.log('poker_server_shutdown_failed');host.exit(1);});
 };
 host.on('SIGTERM',stop);host.on('SIGINT',stop);
 try{service=create();await service.start();if(!stopping)host.log('poker_server_ready');}
 catch{failed=true;host.log('poker_server_start_failed');stop();}
}
