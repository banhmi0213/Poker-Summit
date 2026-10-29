-- Tournament settings: turn time (20 or 30 seconds), time bank cards at start (1-5) and optional
-- final table cards (0-5). The keys are optional so saved tournaments stay valid (defaults 20s / 2 cards / none).
create or replace function public.valid_poker_structure(s jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare p jsonb; levels integer:=0; previous_sb bigint:=0; previous_bb bigint:=0; sb bigint; bb bigint; ante bigint; mins integer;
begin
 if s is null or jsonb_typeof(s) is distinct from 'object' or not(s ?& array['startingStack','anteType','lateRegLevel','reentry','periods']) or jsonb_typeof(s->'startingStack')<>'number' or (s->>'startingStack')!~'^[0-9]+$' or (s->>'startingStack')::bigint not between 1 and 1000000000
 or coalesce(s->>'anteType','') not in ('none','bb','per-player') or jsonb_typeof(s->'reentry')<>'boolean' or jsonb_typeof(s->'periods')<>'array' then return false; end if;
 if s ? 'turnSeconds' and (s->'turnSeconds') not in ('20'::jsonb,'30'::jsonb) then return false; end if;
 if s ? 'timeBankCards' and (jsonb_typeof(s->'timeBankCards')<>'number' or (s->>'timeBankCards')!~'^[1-5]$') then return false; end if;
 if s ? 'finalTableCards' and (jsonb_typeof(s->'finalTableCards')<>'number' or (s->>'finalTableCards')!~'^[0-5]$') then return false; end if;
 if jsonb_array_length(s->'periods') not between 1 and 100 or s->'periods'->0->>'kind' is distinct from 'level' or s->'periods'->(-1)->>'kind' is distinct from 'level' then return false; end if;
 for p in select value from jsonb_array_elements(s->'periods') loop
  if jsonb_typeof(p) is distinct from 'object' or not(p ?& array['kind','minutes','sb','bb','ante','note']) or coalesce(p->>'kind','') not in ('level','break') or jsonb_typeof(p->'minutes')<>'number' or (p->>'minutes')!~'^[0-9]+$' or jsonb_typeof(p->'note')<>'string' or length(p->>'note')>200 then return false; end if;
  mins:=(p->>'minutes')::integer;if mins not between 1 and 240 then return false; end if;
  if p->>'kind'='level' then
   if jsonb_typeof(p->'sb')<>'number' or jsonb_typeof(p->'bb')<>'number' or jsonb_typeof(p->'ante')<>'number' or (p->>'sb')!~'^[0-9]+$' or (p->>'bb')!~'^[0-9]+$' or (p->>'ante')!~'^[0-9]+$' then return false; end if;
   sb:=(p->>'sb')::bigint;bb:=(p->>'bb')::bigint;ante:=(p->>'ante')::bigint;
   if sb not between 1 and 1000000000 or bb<sb or bb>1000000000 or ante not between 0 and 1000000000 or sb<previous_sb or bb<previous_bb or (s->>'anteType'='none' and ante<>0) then return false; end if;
   previous_sb:=sb;previous_bb:=bb;levels:=levels+1;
  else
   if p->'sb'<>'0'::jsonb or p->'bb'<>'0'::jsonb or p->'ante'<>'0'::jsonb then return false; end if;
  end if;
 end loop;
 if jsonb_typeof(s->'lateRegLevel')<>'number' or (s->>'lateRegLevel')!~'^[0-9]+$' then return false; end if;
 return (s->>'lateRegLevel')::integer between 0 and levels;
exception when others then return false;
end;
$$;
