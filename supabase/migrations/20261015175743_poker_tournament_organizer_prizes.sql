create function public.valid_poker_prizes(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare p jsonb; ranks integer[] := '{}'; n numeric;
begin
 if value is null or jsonb_typeof(value) <> 'array' then return false; end if;
 if jsonb_array_length(value) > 100 then return false; end if;
 for p in select jsonb_array_elements(value) loop
  if jsonb_typeof(p) <> 'object' or not (p ?& array['rank','kind','chips','description']) then return false; end if;
  if jsonb_typeof(p->'rank') <> 'number' or jsonb_typeof(p->'chips') <> 'number' or jsonb_typeof(p->'kind') <> 'string' or jsonb_typeof(p->'description') <> 'string' then return false; end if;
  n := (p->>'rank')::numeric;
  if n <> trunc(n) or n < 1 or n > 1000 or n::integer = any(ranks) then return false; end if;
  ranks := array_append(ranks,n::integer);
  if length(p->>'description') > 500 then return false; end if;
  n := (p->>'chips')::numeric;
  if p->>'kind' = 'chips' then
   if n <> trunc(n) or n < 1 or n > 1000000000 then return false; end if;
  elsif p->>'kind' = 'text' then
   if n <> 0 or length(btrim(p->>'description')) = 0 then return false; end if;
  else return false;
  end if;
 end loop;
 return true;
exception when others then return false;
end $$;
alter table public.poker_tournaments
 add column organizer_name text not null default '' check (length(organizer_name) <= 200),
 add column prizes jsonb not null default '[]'::jsonb check (public.valid_poker_prizes(prizes) is true);
