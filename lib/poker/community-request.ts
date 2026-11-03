const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function communityPostId(value:string|null){if(value!==null&&!uuid.test(value))throw Error('Invalid post');return value;}
export function communityMessage(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid message');
 const p=value as Record<string,unknown>,reply=p.type==='reply';
 if(p.type!=='post'&&!reply||Object.keys(p).sort().join(',')!==(reply?'body,id,postId,type':'body,id,title,type'))throw Error('Invalid fields');
 if(typeof p.id!=='string'||!uuid.test(p.id)||typeof p.body!=='string'||!p.body.trim()||p.body.length>1000)throw Error('Invalid body');
 if(reply){if(typeof p.postId!=='string'||!uuid.test(p.postId))throw Error('Invalid thread');return {type:'reply' as const,id:p.id,postId:p.postId,body:p.body.trim()};}
 if(typeof p.title!=='string'||!p.title.trim()||p.title.length>100)throw Error('Invalid title');
 return {type:'post' as const,id:p.id,title:p.title.trim(),body:p.body.trim()};
}
