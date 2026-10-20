import {tournamentActor,type TournamentFormState} from './tournament-admin';
import {ringColumns,validateRingSettings,type RingTable} from './ring-tables';
import {revalidatePath} from '@/lib/revalidate';
export async function loadManagedRings(){const {client}=await tournamentActor('admin');const {data,error}=await client.from('poker_ring_tables').select(ringColumns).is('deleted_at',null).order('sort_order').order('created_at');return {rows:(data??[]) as RingTable[],error:error?'リング卓設定を取得できません。DBの準備状況をご確認ください。':null};}
export async function saveManagedRing(form:FormData):Promise<TournamentFormState>{try{
 const {client}=await tournamentActor('admin'),id=String(form.get('id')??''),revision=Number(form.get('revision')??0);
 if(id&&!/^[a-f0-9-]{36}$/i.test(id)||!Number.isSafeInteger(revision)||revision<0)throw Error('卓の情報を確認してください。');
 const settings=validateRingSettings({title:String(form.get('title')??''),capacity:Number(form.get('capacity')),sb:Number(form.get('sb')),bb:Number(form.get('bb')),min_buy_in:Number(form.get('min_buy_in')),max_buy_in:Number(form.get('max_buy_in')),sort_order:Number(form.get('sort_order')),note:String(form.get('note')??''),published:form.get('published')==='on'});
 const {data,error}=await client.rpc('poker_admin_ring_save',{p_id:id||null,p_expected:revision,p_settings:settings});
 if(error||!data)throw Error(error?.message.includes('changed')?'他の操作で設定が更新されました。再読み込みしてください。':'保存できませんでした。権限とDBの準備状況をご確認ください。');
 revalidatePath('/admin/poker-rings');revalidatePath('/poker-lobby');return {ok:true,message:settings.published?'卓設定を公開しました。':'卓設定を下書き保存しました。',id:data.id};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'保存に失敗しました。'};}}
export async function removeManagedRing(form:FormData):Promise<TournamentFormState>{try{
 const {client}=await tournamentActor('admin'),id=String(form.get('id')??''),title=String(form.get('title')??''),revision=Number(form.get('revision'));
 if(!/^[a-f0-9-]{36}$/i.test(id)||String(form.get('confirmation')??'')!==title||!title||!Number.isSafeInteger(revision)||revision<1)throw Error('削除確認欄に卓名を正確に入力してください。');
 const {error}=await client.rpc('poker_admin_ring_remove',{p_id:id,p_expected:revision,p_title:title});
 if(error)throw Error('削除できませんでした。設定が更新・削除されていないか、再読み込みしてご確認ください。');
 revalidatePath('/admin/poker-rings');revalidatePath('/poker-lobby');return {ok:true,message:'卓設定を削除しました。'};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'削除できませんでした。'};}}
