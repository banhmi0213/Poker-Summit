-- Realtime uses the existing participant SELECT policies; do not widen table grants or RLS.
do $$
declare target text;
begin
  foreach target in array array['dealer_chat_messages','dealer_chat_terms','dealer_matching_records'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=target) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end $$;
