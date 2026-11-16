-- Run this in the Supabase SQL Editor.
-- Create Auth users in Supabase first, then assign each user's UUID below.

create table if not exists public.vault_users (
    user_id uuid primary key references auth.users (id) on delete cascade,
    role text not null check (role in ('admin', 'viewer'))
);

alter table public.vault_users enable row level security;

revoke all on table public.vault_users from anon, authenticated;
grant select on table public.vault_users to authenticated;

drop policy if exists "Users can read their own vault role" on public.vault_users;
create policy "Users can read their own vault role"
    on public.vault_users
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

create or replace function public.is_vault_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.vault_users
        where user_id = (select auth.uid())
          and role = 'admin'
    );
$$;

revoke all on function public.is_vault_admin() from public, anon;
grant execute on function public.is_vault_admin() to authenticated;

insert into storage.buckets (id, name, public)
values ('private-vault', 'private-vault', false)
on conflict (id) do update set public = false;

drop policy if exists "Vault members can list and read files" on storage.objects;
create policy "Vault members can list and read files"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'private-vault'
        and exists (
            select 1
            from public.vault_users
            where user_id = (select auth.uid())
        )
    );

drop policy if exists "Vault admins can upload files" on storage.objects;
create policy "Vault admins can upload files"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'private-vault'
        and (select public.is_vault_admin())
    );

drop policy if exists "Vault admins can delete files" on storage.objects;
create policy "Vault admins can delete files"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'private-vault'
        and (select public.is_vault_admin())
    );

-- After creating users in Authentication > Users, assign roles like this:
-- insert into public.vault_users (user_id, role)
-- values ('AUTH_USER_UUID', 'admin');
-- insert into public.vault_users (user_id, role)
-- values ('AUTH_USER_UUID', 'viewer');
