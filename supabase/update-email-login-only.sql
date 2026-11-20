-- Palm Bite Loyalty UPDATE: only Palm Bite email and password sign-ins get staff or admin powers.
-- Safe to run more than once. Paste into Supabase > SQL Editor and click Run, once.

-- Palm Bite Loyalty: only Palm Bite email and password sign-ins count.
-- Sessions from outside providers (Google, Facebook, Apple, other apps,
-- single sign-on, anonymous) never get staff or admin powers, even if such a
-- provider is switched on by mistake. Safe to run more than once.

create or replace function public.first_party_session()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  with c as (select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) as j)
  select
    coalesce((select j -> 'app_metadata' ->> 'provider' from c), 'email') = 'email'
    and coalesce((select (j ->> 'is_anonymous')::boolean from c), false) = false
    and not exists (
      select 1 from c, jsonb_array_elements(coalesce(c.j -> 'amr', '[]'::jsonb)) a
      where a ->> 'method' in ('oauth', 'sso/saml', 'anonymous', 'web3', 'id_token')
    )
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() in ('staff', 'admin'), false) and public.first_party_session()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() = 'admin', false) and public.first_party_session()
$$;

grant execute on function public.first_party_session() to anon, authenticated;

notify pgrst, 'reload schema';
