-- Additive phase 1. Keep existing thread/reply content and member-only access.
create schema if not exists private;
alter table public.board_replies add column if not exists parent_reply_id uuid references public.board_replies(id) on delete cascade;
create index if not exists board_replies_parent_fk on public.board_replies(parent_reply_id) where parent_reply_id is not null;
create index if not exists board_replies_parent_created on public.board_replies(post_id,parent_reply_id,created_at,id);

create table public.board_thread_preferences (
 post_id uuid not null references public.board_posts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 following boolean not null default false,
 notifications_enabled boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create index board_preferences_user on public.board_thread_preferences(user_id,following);
create table public.board_reactions (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.board_posts(id) on delete cascade,
 reply_id uuid references public.board_replies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check (emoji in ('helpful','thanks','nice','thinking')),
 created_at timestamptz not null default now(),
 unique nulls not distinct(post_id,reply_id,user_id,emoji)
);
create index board_reactions_reply on public.board_reactions(reply_id);
create index board_reactions_user on public.board_reactions(user_id);
create table public.board_resolutions (
 post_id uuid primary key references public.board_posts(id) on delete cascade,
 reply_id uuid references public.board_replies(id) on delete set null,
 created_at timestamptz not null default now()
);
create index board_resolutions_reply on public.board_resolutions(reply_id);
create table public.board_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 post_id uuid not null references public.board_posts(id) on delete cascade,
 reply_id uuid references public.board_replies(id) on delete cascade,
 kind text not null check(kind in ('mention','reply','thread')),
 read_at timestamptz,
 created_at timestamptz not null default now(),
 unique nulls not distinct(user_id,post_id,reply_id)
);
create index board_notifications_user_created on public.board_notifications(user_id,created_at desc);
create index board_notifications_actor on public.board_notifications(actor_id);
create index board_notifications_post on public.board_notifications(post_id);
create index board_notifications_reply on public.board_notifications(reply_id);

-- Invoker helper: callers can only see targets already allowed by board RLS.
create function public.board_target_visible(p_post uuid,p_reply uuid default null) returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and not public.is_suspended()
 and exists(select 1 from public.board_posts p where p.id=p_post and p.status='visible')
 and (p_reply is null or exists(select 1 from public.board_replies r where r.id=p_reply and r.post_id=p_post and r.status='visible'
 and (r.parent_reply_id is null or exists(select 1 from public.board_replies parent where parent.id=r.parent_reply_id and parent.status='visible'))));
$$;
revoke all on function public.board_target_visible(uuid,uuid) from public,anon;
grant execute on function public.board_target_visible(uuid,uuid) to authenticated;

alter table public.board_thread_preferences enable row level security;
alter table public.board_reactions enable row level security;
alter table public.board_resolutions enable row level security;
alter table public.board_notifications enable row level security;
revoke all on public.board_thread_preferences,public.board_reactions,public.board_resolutions,public.board_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.board_thread_preferences to authenticated;
grant select,insert,delete on public.board_reactions,public.board_resolutions to authenticated;
grant select on public.board_notifications to authenticated;
grant update(read_at) on public.board_notifications to authenticated;
create policy board_preferences_own_read on public.board_thread_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy board_preferences_own_insert on public.board_thread_preferences for insert to authenticated with check(user_id=(select auth.uid()) and public.board_target_visible(post_id));
create policy board_preferences_own_update on public.board_thread_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and public.board_target_visible(post_id));
create policy board_preferences_own_delete on public.board_thread_preferences for delete to authenticated using(user_id=(select auth.uid()) and not public.is_suspended());
create policy board_reactions_read on public.board_reactions for select to authenticated using(public.board_target_visible(post_id,reply_id));
create policy board_reactions_insert on public.board_reactions for insert to authenticated with check(user_id=(select auth.uid()) and public.board_target_visible(post_id,reply_id));
create policy board_reactions_delete on public.board_reactions for delete to authenticated using(user_id=(select auth.uid()) and not public.is_suspended());
create policy board_resolutions_read on public.board_resolutions for select to authenticated using(public.board_target_visible(post_id));
create policy board_resolutions_owner_insert on public.board_resolutions for insert to authenticated with check(public.board_target_visible(post_id,reply_id) and exists(select 1 from public.board_posts p where p.id=post_id and p.author_user_id=(select auth.uid())));
create policy board_resolutions_owner_delete on public.board_resolutions for delete to authenticated using(not public.is_suspended() and exists(select 1 from public.board_posts p where p.id=post_id and p.author_user_id=(select auth.uid())));
create policy board_notifications_own_read on public.board_notifications for select to authenticated using(user_id=(select auth.uid()) and public.board_target_visible(post_id,reply_id));
create policy board_notifications_own_update on public.board_notifications for update to authenticated using(user_id=(select auth.uid()) and public.board_target_visible(post_id,reply_id)) with check(user_id=(select auth.uid()) and public.board_target_visible(post_id,reply_id));

-- A reply-to-reply always belongs to one root in the same thread. Never permit
-- reparenting after publication (cycles and cross-thread reply injection).
create function private.board_reply_parent_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and (new.post_id is distinct from old.post_id or new.parent_reply_id is distinct from old.parent_reply_id) then
  raise exception '返信先は変更できません';
 end if;
 if new.parent_reply_id is not null and not exists(select 1 from public.board_replies r where r.id=new.parent_reply_id and r.id<>new.id and r.post_id=new.post_id and r.parent_reply_id is null and r.status='visible') then
  raise exception '返信先が見つかりません';
 end if;
 if TG_OP='INSERT' and not public.board_target_visible(new.post_id,new.parent_reply_id) then raise exception '投稿できないスレッドです'; end if;
 return new;
end; $$;
revoke all on function private.board_reply_parent_guard() from public,anon,authenticated;
create trigger board_reply_parent_guard before insert or update of post_id,parent_reply_id on public.board_replies for each row execute function private.board_reply_parent_guard();

-- Canonical display labels prevent a forged token from impersonating another
-- member's name. Plain @text without selecting a candidate remains plain text.
create function private.board_normalize_mentions() returns trigger language plpgsql security invoker set search_path='' as $$
declare m text[]; v_name text; v_tokens integer:=0;
begin
 for m in select regexp_matches(new.body,'@\[([^\]\r\n]{1,80})\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)','g') loop
  v_tokens:=v_tokens+1;
  if v_tokens>10 then raise exception 'メンションは1投稿10件までです'; end if;
  select p.display_name into v_name from public.profiles p where p.user_id=m[2]::uuid;
  if v_name is null or v_name='' or v_name ~ '[\]\r\n]' then
   new.body:=replace(new.body,'@['||m[1]||']('||m[2]||')','@'||m[1]);
  else
   new.body:=replace(new.body,'@['||m[1]||']('||m[2]||')','@['||v_name||']('||m[2]||')');
  end if;
 end loop;
 return new;
end; $$;
revoke all on function private.board_normalize_mentions() from public,anon,authenticated;
create trigger board_post_mentions before insert or update of body on public.board_posts for each row execute function private.board_normalize_mentions();
create trigger board_reply_mentions before insert or update of body on public.board_replies for each row execute function private.board_normalize_mentions();

-- Internal delivery needs to insert notifications for OTHER users. Keep it out
-- of the exposed schema; the trigger only accepts the authenticated author.
create function private.board_deliver_notifications() returns trigger language plpgsql security definer set search_path='' as $$
declare v_post uuid; v_reply uuid; v_owner uuid; v_parent_author uuid;
begin
 if auth.uid() is null or auth.uid() is distinct from new.author_user_id or public.is_suspended() or new.status<>'visible' then return new; end if;
 if TG_TABLE_NAME='board_posts' then v_post:=new.id; v_reply:=null;
 else
  v_post:=new.post_id; v_reply:=new.id;
  select r.author_user_id into v_parent_author from public.board_replies r where r.id=new.parent_reply_id;
 end if;
 select p.author_user_id into v_owner from public.board_posts p where p.id=v_post and p.status='visible';
 if not found then return new; end if;
 insert into public.board_notifications(user_id,actor_id,post_id,reply_id,kind)
 select c.user_id,new.author_user_id,v_post,v_reply,
 case min(c.priority) when 1 then 'mention' when 2 then 'reply' else 'thread' end
 from (
  select mentions.user_id,1 as priority from (
   select (m.match)[1]::uuid as user_id from regexp_matches(new.body,'@\[[^\]\r\n]{1,80}\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)','g') as m(match) limit 10
  ) mentions
  union all select v_parent_author,2 where v_reply is not null and v_parent_author is not null
  union all select v_owner,2 where v_reply is not null and v_owner is not null
  union all select f.user_id,3 from public.board_thread_preferences f where f.post_id=v_post and f.following and v_reply is not null
 ) c
 join auth.users u on u.id=c.user_id
 where c.user_id<>new.author_user_id
 and not exists(select 1 from public.board_thread_preferences pref where pref.post_id=v_post and pref.user_id=c.user_id and not pref.notifications_enabled)
 group by c.user_id
 on conflict do nothing;
 return new;
end; $$;
revoke all on function private.board_deliver_notifications() from public,anon,authenticated;
create trigger board_post_notifications after insert on public.board_posts for each row execute function private.board_deliver_notifications();
create trigger board_reply_notifications after insert on public.board_replies for each row execute function private.board_deliver_notifications();

create function public.board_reply_counts(p_post_id uuid) returns table(parent_reply_id uuid,total bigint)
language sql stable security invoker set search_path='' as $$
 select r.parent_reply_id,count(*) from public.board_replies r where r.post_id=p_post_id and r.status='visible'
 and public.board_target_visible(r.post_id,r.id) group by r.parent_reply_id;
$$;
revoke all on function public.board_reply_counts(uuid) from public,anon;
grant execute on function public.board_reply_counts(uuid) to authenticated;

-- Return only aggregate counts and the caller's selections, not other members'
-- IDs. Limit the target set to one displayed page plus its expanded children.
create function public.board_reaction_summary(p_post_id uuid,p_reply_ids uuid[] default '{}')
returns table(reply_id uuid,emoji text,total bigint,mine boolean)
language sql stable security invoker set search_path='' as $$
 select r.reply_id,r.emoji,count(*),bool_or(r.user_id=auth.uid()) from public.board_reactions r
 where r.post_id=p_post_id and (r.reply_id is null or r.reply_id=any(p_reply_ids))
 group by r.reply_id,r.emoji;
$$;
revoke all on function public.board_reaction_summary(uuid,uuid[]) from public,anon;
grant execute on function public.board_reaction_summary(uuid,uuid[]) to authenticated;
