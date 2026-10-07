"use server";
import { requireMatchingConsent } from "@/lib/matching-consent-server";
import { randomUUID } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createStoreClient } from '@/lib/supabase/store-server';
import { DEALER_GAMES } from '@/lib/dealers';
import { UUID, validDate, validTime, validateShifts, type SpotShift } from '@/lib/spot-jobs';

export async function saveSpotJob(_state: { error: string }, form: FormData): Promise<{error:string}> {
  const db = await createStoreClient();
  const {data:{user}} = await db.auth.getUser();
  if (!user) redirect('/store/login?next=/store/profile/spot-jobs');
  const {data:suspended,error:suspendError} = await db.rpc('is_suspended');
  if (suspendError || suspended) return {error:'このアカウントでは保存できません。'};
  const {data:store,error:storeError} = await db.from('stores').select('id').eq('owner_user_id',user.id).limit(1).maybeSingle();
  if (storeError || !store) return {error:'店舗情報を確認できませんでした。'};
  await requireMatchingConsent(db,user.id,"store","/store/profile/spot-jobs");
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
    const first=Math.min(...shifts.map(s=>Date.parse(s.work_date+'T'+s.start_time+':00+09:00')));
    if (published && (deadline<=Date.now() || deadline>first)) throw new Error('公開する求人の応募締切は、現在より後・最初の勤務開始までに設定してください。');
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
  const {error}=await db.rpc('save_spot_job',{p_id:id||null,p_store_id:store.id,p_games:games,p_duties:duties,p_requirements:requirements,p_transport_type:transport,p_transport_limit:limit,p_dress:dress,p_deadline:deadlineRaw+':00+09:00',p_image:imagePath,p_published:published,p_shifts:shifts});
  if (error) {
    if (uploaded) await db.storage.from('spot-job-images').remove([uploaded]);
    return {error:'保存できませんでした。入力内容を確認してもう一度お試しください。'};
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

