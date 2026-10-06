grant delete on public.major_tournaments to authenticated;
create policy major_tournaments_admin_delete on public.major_tournaments for delete to authenticated using ((select public.is_admin()));
