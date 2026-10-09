"use server";
import { requireMatchingConsent } from "@/lib/matching-consent-server";
import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createStoreClient } from '@/lib/supabase/store-server';
import { DEALER_GAMES } from '@/lib/dealers';
import { UUID, validDate, validTime, validateShifts, type SpotShift } from '@/lib/spot-jobs';
import { getStorePlan, spotMonthlyLimitOf } from '@/lib/plan-entitlements';

export async function saveSpotJob(_state: { error: string }, form: FormData): Promise<{error:string}> {
  const db = await createStoreClient();
  const {data:{user}} = await db.auth.getUser();
  if (!user) redirect('/store/login?next=/store/profile/spot-jobs');
  const {data:suspended,error:suspendError} = await db.rpc('is_suspended');
  if (suspendError || suspended) return {error:'このアカウントでは保存できません。'};
  const {data:store,error:storeError} = await db.from('stores').select('id').eq('owner_user_id',user.id).limit(1).maybeSingle();
  if (storeError || !store) return {error:'店舗情報を確認できませんでした。'};
  await requireMatchingConsent(db,user.id,"store","/store/profile/spot-jobs");
  // スポット求人の公開はスタンダードプラン以上(2026/10)。最終的な判定はDBトリガー。
  if (form.get('published')==='true' && spotMonthlyLimitOf(await getStorePlan(db,store.id))===0) {
    // ライトプラン等: 「スポット求人1件掲載」の追加掲載枠があれば公開できる(枠の消費はDBトリガー)
    const editingId = String(form.get('id') || '');
    const [{data:credit},{data:existing}] = await Promise.all([
      db.from('store_spot_credits').select('balance').eq('store_id',store.id).maybeSingle(),
      editingId ? db.from('spot_jobs').select('credit_used').eq('id',editingId).eq('store_id',store.id).maybeSingle() : Promise.resolve({data:null}),
    ]);
    if (!(existing as {credit_used?:boolean}|null)?.credit_used && !((credit?.balance ?? 0) > 0)) {
      return {error:'スポット求人の公開はスタンダードプラン以上、または「スポット求人1件掲載」（2,200円）の追加でご利用いただけます。「公開しない」にすると下書きとして保存できます。'};
    }
  }
  const id = String(form.get('id') || '');
  if (id && !UUID.test(id)) return {error:'求人を確認できませんでした。'};
  let current: {image_path:string|null}|null = null;
  if (id) {
    const result = await db.from('spot_jobs').select('image_path').eq('id',id).eq('store_id',store.id).maybeSingle();
    if (result.error || !result.data) return {error:'編集できる求人が見つかりません。'};
    current = result.data;
  }
  const value = (key:string) => String(form.get(key)||'').trim();
  const games = [...new Set(form.getAll('games').map(String))];
  const contractType=value('contract_type'),paymentMethod=value('payment_method'),paymentDate=value('payment_date'),contractNotes=value('contract_notes');
  if(!['employment','contract'].includes(contractType)||!['bank','cash'].includes(paymentMethod)||!paymentDate||paymentDate.length>100||!contractNotes||contractNotes.length>2000)return {error:'契約形態・支払方法・支払日・その他の合意事項を入力してください（事項がない場合は「なし」）。'};
  const duties=value('duties'), requirements=value('requirements'), dress=value('dress');
  const transport=value('transport_type'), limit=transport==='limited'?Number(value('transport_limit')):null;
  const deadlineRaw=value('deadline'), published=form.get('published')==='true';
  let shifts: SpotShift[];
  try {
    shifts=JSON.parse(value('shifts'));
    if (Array.isArray(shifts)) shifts=shifts.map(s=>({...s,break_minutes:0}));
    validateShifts(shifts);
    if (!games.length || games.some(g=>!DEALER_GAMES.includes(g))) throw new Error('ゲーム種目を選択してください。');
    if (!duties || duties.length>3000 || requirements.length>3000 || dress.length>2000) throw new Error('業務内容を入力し、各項目の文字数を確認してください。');
    if (!['none','full','limited'].includes(transport) || (transport==='limited' && (!value('transport_limit') || !Number.isInteger(limit) || Number(limit)<0 || Number(limit)>100000))) throw new Error('交通費の支給方法・上限を確認してください。');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadlineRaw) || !validDate(deadlineRaw.slice(0,10)) || !validTime(deadlineRaw.slice(11))) throw new Error('応募締切を入力してください。');
    const deadline=Date.parse(deadlineRaw+':00+09:00');
    if (published && deadline<=Date.now()) throw new Error('公開する求人の応募締切は、現在より後に設定してください。');
  } catch(e) { return {error:e instanceof Error?e.message:'勤務日を確認してください。'}; }
  let imagePath=form.get('removeImage')==='on'?null:current?.image_path??null;
  let uploaded:string|null=null;
  const image=form.get('image');
  if (image instanceof File && image.size>0) {
    const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'} as Record<string,string>)[image.type];
    if (!ext || image.size>3145728) return {error:'画像はJPEG・PNG・WebP、3MB以内で選んでください。'};
    uploaded=store.id+'/'+randomUUID()+'.'+ext;
    const {error}=await db.storage.from('spot-job-images').upload(uploaded,image,{contentType:image.type});
    if (error) return {error:'画像をアップロードできませんでした。'};
    imagePath=uploaded;
  }
  const {error}=await db.rpc('save_spot_job_with_terms',{p_id:id||null,p_store_id:store.id,p_games:games,p_duties:duties,p_requirements:requirements,p_transport_type:transport,p_transport_limit:limit,p_dress:dress,p_deadline:deadlineRaw+':00+09:00',p_image:imagePath,p_published:published,p_shifts:shifts,p_terms:{contract_type:contractType,payment_method:paymentMethod,payment_date:paymentDate,notes:contractNotes}});
  if (error) {
    if (uploaded) await db.storage.from('spot-job-images').remove([uploaded]);
    return {error:error.code==='P0001'?error.message:'保存できませんでした。入力内容を確認してもう一度お試しください。'};
  }
  if (current?.image_path && current.image_path!==imagePath) await db.storage.from('spot-job-images').remove([current.image_path]);
  revalidatePath('/store/profile/spot-jobs','layout');
  revalidatePath('/spot-jobs','layout');
  redirect('/store/profile/spot-jobs?saved='+randomUUID()+(id?'&edit='+id:''));
}

export async function closeSpotJob(form:FormData) {
  const db=await createStoreClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) redirect('/store/login');
  const id=String(form.get('id')||'');
  const {data:store}=await db.from('stores').select('id').eq('owner_user_id',user.id).limit(1).maybeSingle();
  if (!store || !UUID.test(id)) redirect('/store/profile/spot-jobs?error=1');
  const {error}=await db.from('spot_jobs').update({published:false}).eq('id',id).eq('store_id',store.id);
  revalidatePath('/spot-jobs','layout');
  revalidatePath('/store/profile/spot-jobs');
  redirect('/store/profile/spot-jobs?'+(error?'error=1':'closed=1'));
}

