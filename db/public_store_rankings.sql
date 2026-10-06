create schema if not exists private;
create or replace function private.store_rankings(p_prefs text[] default null)
returns table(id uuid,name text,category text,pref text,city text,description text,logo_url text,banner_url text,favorite_count bigint)
language sql stable security definer set search_path = '' as $$
 select s.id,s.name::text,s.category::text,s.pref::text,s.city::text,s.description::text,s.logo_url::text,s.banner_url::text,count(f.store_id)
 from public.stores s left join public.favorite_stores f on f.store_id=s.id
 where s.status in ('approved','listed') and (p_prefs is null or s.pref=any(p_prefs))
 group by s.id
 order by count(f.store_id) desc,random()
 limit 10;
$$;
revoke all on function private.store_rankings(text[]) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.store_rankings(text[]) to anon,authenticated;
create or replace function public.public_store_rankings(p_prefs text[] default null)
returns table(id uuid,name text,category text,pref text,city text,description text,logo_url text,banner_url text,favorite_count bigint)
language sql stable security invoker set search_path = '' as $$
 select * from private.store_rankings(p_prefs);
$$;
revoke all on function public.public_store_rankings(text[]) from public;
grant execute on function public.public_store_rankings(text[]) to anon,authenticated;