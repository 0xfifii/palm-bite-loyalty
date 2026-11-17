-- Palm Bite Loyalty UPDATE: usernames (unique, sign in with username or email). Safe to run more than once.
-- Paste into Supabase > SQL Editor and click Run, once.

-- Palm Bite Loyalty: usernames.
-- Every Palm Fren can have one unique username (no two accounts share one,
-- whatever the capital letters) and sign in with it instead of their email.

create or replace function public.username_is_valid(p_username text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_username ~ '^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$'
     and p_username !~ '[._]{2}'
     and p_username not in (
       'admin', 'administrator', 'staff', 'palmstaff', 'palmbite', 'palm_bite', 'palm.bite',
       'palmbitecafe', 'palmbite_cafe', 'support', 'help', 'root', 'owner', 'manager', 'system', 'official'
     )
$$;

alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_valid;
alter table public.profiles add constraint profiles_username_valid
  check (username is null or (username = lower(username) and public.username_is_valid(username)));
create unique index if not exists profiles_username_key on public.profiles (username);

-- Palm Frens may set or change their own username (format and uniqueness are
-- enforced above).
grant update (username) on public.profiles to authenticated;

-- Sign-up checks, now including the username. Server only.
create or replace function public.registration_conflicts(p_email text, p_phone text, p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'email_taken', exists (select 1 from public.profiles where email = lower(btrim(p_email))),
    'phone_taken', p_phone is not null and exists (select 1 from public.profiles where phone = p_phone),
    'username_taken', p_username is not null and exists (select 1 from public.profiles where username = lower(btrim(p_username)))
  )
$$;
revoke execute on function public.registration_conflicts(text, text, text) from public, anon, authenticated;
grant execute on function public.registration_conflicts(text, text, text) to service_role;

-- Username sign-in: the server swaps a username for its email, then signs in
-- with the password as usual. Server only, never exposed to the browser.
create or replace function public.email_for_username(p_username text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select email from public.profiles where username = lower(btrim(p_username)) limit 1
$$;
revoke execute on function public.email_for_username(text) from public, anon, authenticated;
grant execute on function public.email_for_username(text) to service_role;

-- New accounts keep the username chosen at sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_phone text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  v_wants_staff boolean := coalesce(new.raw_user_meta_data ->> 'account_type', '') = 'staff';
  v_username text := nullif(lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '');
begin
  if char_length(v_name) < 2 then
    v_name := split_part(coalesce(new.email, 'Palm Bite Guest'), '@', 1);
    if char_length(v_name) < 2 then
      v_name := 'Palm Bite Guest';
    end if;
  end if;

  -- Everyone starts as a customer. A staff request never grants access by itself.
  if v_username is not null and not public.username_is_valid(v_username) then
    v_username := null;
  end if;

  insert into public.profiles (id, full_name, phone, email, username, role, staff_request, staff_requested_at)
  values (
    new.id, left(v_name, 80), v_phone, lower(new.email), v_username, 'customer',
    case when v_wants_staff then 'pending' end,
    case when v_wants_staff then now() end
  );

  insert into public.loyalty_accounts (customer_id, current_points, cycle_number)
  values (new.id, 0, 1);

  return new;
end;
$$;

-- Staff and admin can find a Palm Fren by username too.
create or replace function public.admin_search_customers(
  p_query text,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  phone text,
  email text,
  role public.user_role,
  status public.account_status,
  current_points integer,
  cycle_number integer,
  total_visits integer,
  rewards_redeemed integer,
  open_reward_status public.reward_status,
  last_visit_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_q text := lower(btrim(coalesce(p_query, '')));
  v_digits text := regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null or not public.is_staff() then
    return;
  end if;

  return query
  select p.id, p.full_name, p.phone, p.email, p.role, p.status,
         a.current_points, a.cycle_number, a.total_visits, a.rewards_redeemed,
         (select r.status from public.rewards r
           where r.customer_id = p.id and r.status in ('available', 'pending') limit 1),
         (select max(v.created_at) from public.visits v where v.customer_id = p.id),
         p.created_at,
         count(*) over ()
  from public.profiles p
  join public.loyalty_accounts a on a.customer_id = p.id
  where v_q = ''
     or position(v_q in lower(p.full_name)) > 0
     or position(v_q in p.email) > 0
     or position(ltrim(v_q, '@') in coalesce(p.username, '')) > 0
     or (char_length(v_digits) >= 3 and position(v_digits in coalesce(p.phone, '')) > 0)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

notify pgrst, 'reload schema';
