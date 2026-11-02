import {createHmac,timingSafeEqual} from 'node:crypto';
/** KOMOJU signs each webhook: X-Komoju-Signature = hex HMAC-SHA256(webhook secret, raw request body). */
export function verifyKomojuSignature(rawBody:string,signature:string|null|undefined,secret:string|null|undefined):boolean{
 if(!secret||!signature||!/^[0-9a-f]{64}$/i.test(signature))return false;
 const expected=createHmac('sha256',secret).update(rawBody,'utf8').digest();
 const given=Buffer.from(signature,'hex');
 return given.length===expected.length&&timingSafeEqual(given,expected);
}
