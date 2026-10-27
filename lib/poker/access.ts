/** Poker is for members with a confirmed e-mail only (owner 2026/10/27: 荒らし対策). The database checks the same for chips. */
export type PokerUser={email_confirmed_at?:string|null;is_anonymous?:boolean}|null;
export function pokerAccess(user:PokerUser):'ok'|'login'|'verify'{
 if(!user)return 'login';
 if(user.is_anonymous||!user.email_confirmed_at)return 'verify';
 return 'ok';
}
