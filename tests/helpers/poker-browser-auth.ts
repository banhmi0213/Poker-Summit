/** Isolated test bundle replacement ONLY. Never imported by application code. */
export function createClient(){
 const session=()=>{const token=sessionStorage.getItem('poker-e2e-token');return token?{access_token:token,user:{id:token}}:null;};
 return {rpc:async()=>({data:{available:3000,inPlay:0,total:3000,rank:1,welcomeGranted:true,asOf:new Date().toISOString(),history:[]},error:null}),auth:{getSession:async()=>({data:{session:session()}}),onAuthStateChange:(callback:(event:string,session:unknown)=>void)=>{callback('INITIAL_SESSION',session());const changed=()=>callback('SIGNED_OUT',null);window.addEventListener('poker-e2e-signout',changed);return {data:{subscription:{unsubscribe:()=>window.removeEventListener('poker-e2e-signout',changed)}}};}}};
}
