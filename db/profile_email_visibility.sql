-- Private email addresses remain in Auth only. No historical emails are published.
alter table public.profiles add column email_public boolean not null default false, add column public_email text;
alter table public.profiles add constraint profiles_private_email_is_empty check (email_public or public_email is null);
