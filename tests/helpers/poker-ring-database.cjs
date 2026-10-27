const fs=require('fs'),path=require('path');
const runtime=process.env.POKER_PGLITE_MODULE||'@electric-sql/pglite';
const {PGlite}=require(runtime),{pgcrypto}=require(path.join(path.dirname(require.resolve(runtime+'/package.json')),'dist/contrib/pgcrypto.cjs'));
/** POKER_DB_MODE=production-upgrade: a database shaped like production before the ring release (main's poker
 * migrations only), upgraded with scripts/poker-release/production-upgrade.sql exactly as production will be. */
async function productionUpgrade(db){
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;create extension pgcrypto with schema extensions;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz,created_at timestamptz,updated_at timestamptz);
 create table public.member_status(user_id uuid primary key,suspended boolean default false);create table public.admin_users(user_id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_suspended() returns boolean language sql as $$select coalesce((select suspended from public.member_status where user_id=auth.uid()),false)$$;
 create function public.is_admin() returns boolean language sql as $$select exists(select 1 from public.admin_users where user_id=auth.uid())$$;
 create table public.stores(id uuid primary key default gen_random_uuid(),name text,owner_user_id uuid);create table public.blog_entries(id uuid primary key default gen_random_uuid());
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
 create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;`);
 const folder=path.resolve(__dirname,'../../supabase/migrations');
 for(const name of ['poker_tournament_settings','poker_tournament_organizer_prizes','poker_tournament_store_access','production_ring_admin_and_removal','poker_news_feed','poker_news_explicit_privileges','poker_news_link_thumbnails']){const file=fs.readdirSync(folder).find(f=>f.endsWith('_'+name+'.sql'));await db.exec(fs.readFileSync(path.join(folder,file),'utf8'));}
 await db.exec(fs.readFileSync(path.resolve(__dirname,'../../scripts/poker-release/production-upgrade.sql'),'utf8'));
 // Re-running the upgrade must be harmless.
 await db.exec(fs.readFileSync(path.resolve(__dirname,'../../scripts/poker-release/production-upgrade.sql'),'utf8'));
 return db;
}
module.exports=async()=>{const db=new PGlite({extensions:{pgcrypto}});if(process.env.POKER_DB_MODE==='production-upgrade'){try{return await productionUpgrade(db);}catch(error){await db.close();throw error;}}try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema extensions;create extension pgcrypto with schema extensions;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb,deleted_at timestamptz,banned_until timestamptz,created_at timestamptz,updated_at timestamptz);
 create table public.member_status(user_id uuid primary key,suspended boolean default false);create table public.admin_users(user_id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.is_suspended() returns boolean language sql as $$select coalesce((select suspended from public.member_status where user_id=auth.uid()),false)$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 create table public.poker_ring_tables(id uuid primary key default gen_random_uuid(),title text,capacity integer,sb bigint,bb bigint,min_buy_in bigint,max_buy_in bigint,note text default '',published boolean default false,deleted_at timestamptz,revision integer default 1,sort_order integer default 0,created_at timestamptz default now(),updated_at timestamptz default now());`);
 const folder=path.resolve(__dirname,'../../supabase/migrations');for(const suffix of ['_poker_welcome_chips_and_escrow.sql','_poker_welcome_member_admin_eligibility.sql','_poker_reservation_member_guard.sql','_poker_ring_seating_and_hand_accounting.sql','_poker_ring_button_context_guard.sql','_poker_ring_atomic_lobby_admission.sql','_poker_ring_deferred_exit.sql','_poker_ring_live_play.sql','_poker_ring_seats_and_timebank.sql','_poker_ring_shorter_result_pause.sql','_poker_ring_twenty_second_turns.sql','_poker_ring_inactivity_policy.sql','_poker_ring_pending_exit_actions.sql','_poker_shop_tickets.sql','_poker_ring_ticket_timebank.sql','_poker_ring_refill.sql']){const file=fs.readdirSync(folder).find(f=>f.endsWith(suffix));await db.exec(fs.readFileSync(path.join(folder,file),'utf8'));}
 return db;}catch(error){await db.close();throw error;}};
