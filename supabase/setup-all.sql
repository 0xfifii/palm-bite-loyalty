-- Palm Bite Loyalty: ONE-STEP SETUP
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- It creates every table, rule and security policy, plus the Palm Bite drink menu.
-- Run it only once, on a new empty project.


-- ===================== 20261019000100_schema.sql =====================
-- Palm Bite Loyalty: core schema
-- Every loyalty rule that matters for money or fairness is enforced here in
-- the database (constraints, locks and security definer functions), not only
-- in the application.

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'staff', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.reward_status as enum ('available', 'pending', 'redeemed', 'cancelled');
create type public.redemption_status as enum ('pending', 'completed', 'cancelled');
create type public.transaction_type as enum (
  'visit',
  'manual_adjustment',
  'redemption_reset',
  'reward_cancelled_reset'
);
create type public.visit_method as enum ('qr', 'staff_assisted');

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.locations (id, slug, name)
values ('00000000-0000-4000-8000-000000000001', 'main', 'Palm Bite');

-- ---------------------------------------------------------------------------
-- Application settings (single row)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  business_timezone text not null default 'Africa/Lagos',
  qr_ttl_seconds integer not null default 60 check (qr_ttl_seconds between 30 and 300),
  default_location_id uuid not null references public.locations (id),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.app_settings (default_location_id)
values ('00000000-0000-4000-8000-000000000001');

create or replace function public.validate_timezone()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.business_timezone) then
    raise exception 'Invalid business timezone: %', new.business_timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger app_settings_validate_timezone
before insert or update of business_timezone on public.app_settings
for each row execute function public.validate_timezone();

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 80),
  phone text unique check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text not null unique check (email = lower(email)),
  role public.user_role not null default 'customer',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_full_name_idx on public.profiles (lower(full_name));

-- ---------------------------------------------------------------------------
-- Loyalty accounts (current cycle state per customer)
-- ---------------------------------------------------------------------------
create table public.loyalty_accounts (
  customer_id uuid primary key references public.profiles (id) on delete cascade,
  current_points integer not null default 0 check (current_points between 0 and 15),
  cycle_number integer not null default 1 check (cycle_number >= 1),
  total_visits integer not null default 0 check (total_visits >= 0),
  rewards_redeemed integer not null default 0 check (rewards_redeemed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- QR sessions (rotating, short-lived visit tokens)
-- Only a SHA-256 hash of each token is stored, never the token itself.
-- ---------------------------------------------------------------------------
create table public.qr_sessions (
  id uuid primary key,
  location_id uuid not null references public.locations (id),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  issued_by uuid references public.profiles (id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text,
  check (expires_at > issued_at)
);

create index qr_sessions_location_expiry_idx on public.qr_sessions (location_id, expires_at desc);

-- ---------------------------------------------------------------------------
-- Visits (one verified visit per customer per business-local day)
-- ---------------------------------------------------------------------------
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  location_id uuid not null references public.locations (id),
  qr_session_id uuid references public.qr_sessions (id) on delete set null,
  method public.visit_method not null,
  visit_date date not null,
  business_timezone text not null,
  cycle_number integer not null check (cycle_number >= 1),
  recorded_by uuid references public.profiles (id) on delete set null,
  idempotency_key uuid,
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  constraint visits_one_per_day unique (customer_id, visit_date),
  constraint visits_idempotency unique (customer_id, idempotency_key),
  check (method <> 'qr' or qr_session_id is not null),
  check (method <> 'staff_assisted' or recorded_by is not null)
);

create index visits_visit_date_idx on public.visits (visit_date desc);
create index visits_customer_created_idx on public.visits (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Rewards (exactly one per completed 15-point cycle)
-- ---------------------------------------------------------------------------
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  cycle_number integer not null check (cycle_number >= 1),
  reference text not null unique,
  status public.reward_status not null default 'available',
  earned_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  constraint rewards_one_per_cycle unique (customer_id, cycle_number),
  check (status <> 'redeemed' or redeemed_at is not null),
  check (status <> 'cancelled' or cancelled_at is not null)
);

-- A customer can never hold two open rewards at the same time.
create unique index rewards_one_open_per_customer
  on public.rewards (customer_id) where status in ('available', 'pending');
create index rewards_status_idx on public.rewards (status, earned_at desc);

-- ---------------------------------------------------------------------------
-- Drinks (menu managed by administrators)
-- customization: [{"name": "Milk", "options": ["Whole", "Oat"], "multi": false}]
-- ---------------------------------------------------------------------------
create table public.drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 400),
  category text not null default 'Drinks' check (char_length(category) between 2 and 40),
  image_url text check (image_url is null or image_url ~ '^(https://|/)'),
  accent_color text not null default '#A9B89A' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  is_reward_eligible boolean not null default true,
  is_sample boolean not null default false,
  customization jsonb not null default '[]'::jsonb check (jsonb_typeof(customization) = 'array'),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index drinks_active_idx on public.drinks (is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Redemptions (a customer's drink choice awaiting staff confirmation)
-- ---------------------------------------------------------------------------
create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  drink_id uuid not null references public.drinks (id) on delete restrict,
  drink_name text not null,
  customizations jsonb not null default '{}'::jsonb check (jsonb_typeof(customizations) = 'object'),
  reference text not null unique check (reference ~ '^PB-[0-9A-Z]{6}$'),
  status public.redemption_status not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancel_reason text,
  check (status <> 'completed' or (completed_at is not null and completed_by is not null)),
  check (status <> 'cancelled' or cancelled_at is not null)
);

create unique index redemptions_one_pending_per_reward
  on public.redemptions (reward_id) where status = 'pending';
create unique index redemptions_one_completed_per_reward
  on public.redemptions (reward_id) where status = 'completed';
create index redemptions_status_idx on public.redemptions (status, requested_at desc);

-- ---------------------------------------------------------------------------
-- Loyalty transactions (append-only points ledger)
-- ---------------------------------------------------------------------------
create table public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  cycle_number integer not null check (cycle_number >= 1),
  type public.transaction_type not null,
  points_delta integer not null check (points_delta between -15 and 15),
  balance_after integer not null check (balance_after between 0 and 15),
  visit_id uuid references public.visits (id) on delete set null,
  reward_id uuid references public.rewards (id) on delete set null,
  redemption_id uuid references public.redemptions (id) on delete set null,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (type <> 'manual_adjustment' or char_length(btrim(coalesce(reason, ''))) >= 5)
);

create index loyalty_transactions_customer_idx on public.loyalty_transactions (customer_id, created_at desc);
create index loyalty_transactions_type_idx on public.loyalty_transactions (type, created_at desc);

-- ---------------------------------------------------------------------------
-- Scan attempts (every QR verification result, for investigation)
-- ---------------------------------------------------------------------------
create table public.scan_attempts (
  id bigint generated always as identity primary key,
  customer_id uuid references public.profiles (id) on delete set null,
  qr_session_id uuid,
  result_code text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index scan_attempts_created_idx on public.scan_attempts (created_at desc);
create index scan_attempts_result_idx on public.scan_attempts (result_code, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Rate limiting buckets (fixed window counters, server use only)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket_key, window_start)
);

-- ---------------------------------------------------------------------------
-- Append-only protection for history tables
-- ---------------------------------------------------------------------------
create or replace function public.prevent_history_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Changes cascaded by foreign keys (for example a full account deletion
  -- requested under data protection rules) run at trigger depth > 1 and are
  -- allowed. Any direct UPDATE or DELETE is rejected.
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception '% is append-only; historical records cannot be changed', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger loyalty_transactions_append_only
before update or delete on public.loyalty_transactions
for each row execute function public.prevent_history_mutation();

create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function public.prevent_history_mutation();

-- Visits may only be removed through account deletion (cascade), never edited.
create trigger visits_no_update
before update on public.visits
for each row execute function public.prevent_history_mutation();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger loyalty_accounts_touch before update on public.loyalty_accounts
for each row execute function public.touch_updated_at();
create trigger drinks_touch before update on public.drinks
for each row execute function public.touch_updated_at();

-- ===================== 20261019000200_functions.sql =====================
-- Palm Bite Loyalty: business logic functions
-- All critical operations are SECURITY DEFINER functions with a fixed
-- search_path. Each one derives the acting user from auth.uid() (or is
-- restricted to the service role) and never trusts balances, roles or
-- statuses supplied by a client.

-- ---------------------------------------------------------------------------
-- Constants and helpers
-- ---------------------------------------------------------------------------
create or replace function public.points_per_reward()
returns integer
language sql
immutable
as $$ select 15 $$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() in ('staff', 'admin'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- Business-local calendar date for an instant in a given IANA timezone.
create or replace function public.business_date_for(p_at timestamptz, p_timezone text)
returns date
language sql
stable
as $$
  select (p_at at time zone p_timezone)::date
$$;

create or replace function public.business_timezone()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select business_timezone from public.app_settings where id
$$;

create or replace function public.business_today()
returns date
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.business_date_for(now(), public.business_timezone())
$$;

-- Random code from an unambiguous 32 character alphabet (no 0, O, 1, I).
-- Uses gen_random_uuid(), which draws from a cryptographically secure source.
-- Bytes 6 and 8 of a v4 UUID carry version bits, so only bytes 0-5 and 9-15
-- of each UUID are used.
create or replace function public.generate_code(p_length integer)
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_positions constant integer[] := array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15];
  v_bytes bytea;
  v_result text := '';
  v_i integer := 0;
begin
  while char_length(v_result) < p_length loop
    if v_i % 13 = 0 then
      v_bytes := uuid_send(gen_random_uuid());
    end if;
    v_result := v_result || substr(v_alphabet, (get_byte(v_bytes, v_positions[(v_i % 13) + 1]) % 32) + 1, 1);
    v_i := v_i + 1;
  end loop;
  return v_result;
end;
$$;

create or replace function public.write_audit(
  p_actor uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

create or replace function public.account_snapshot(p_customer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'points', a.current_points,
    'cycle', a.cycle_number,
    'total_visits', a.total_visits,
    'rewards_redeemed', a.rewards_redeemed
  )
  from public.loyalty_accounts a
  where a.customer_id = p_customer
$$;

-- ---------------------------------------------------------------------------
-- New user provisioning: every account starts at zero points.
-- The role is always 'customer'; metadata can never grant a role.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_phone text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
begin
  if char_length(v_name) < 2 then
    v_name := split_part(coalesce(new.email, 'Palm Bite Guest'), '@', 1);
    if char_length(v_name) < 2 then
      v_name := 'Palm Bite Guest';
    end if;
  end if;

  insert into public.profiles (id, full_name, phone, email, role)
  values (new.id, left(v_name, 80), v_phone, lower(new.email), 'customer');

  insert into public.loyalty_accounts (customer_id, current_points, cycle_number)
  values (new.id, 0, 1);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.handle_user_email_change();

-- Used by the registration server action to give a friendly duplicate message
-- before the auth user is created. Returns only booleans.
create or replace function public.registration_conflicts(p_email text, p_phone text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'email_taken', exists (select 1 from public.profiles where email = lower(btrim(p_email))),
    'phone_taken', p_phone is not null and exists (select 1 from public.profiles where phone = p_phone)
  )
$$;

-- ---------------------------------------------------------------------------
-- Reward issue (internal). Called with the account row already locked.
-- ---------------------------------------------------------------------------
create or replace function public._issue_reward_if_complete(p_customer uuid, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.loyalty_accounts;
  v_reward_id uuid;
  v_reference text;
begin
  select * into v_account from public.loyalty_accounts where customer_id = p_customer;
  if v_account.current_points < public.points_per_reward() then
    return null;
  end if;

  -- Unique (customer_id, cycle_number) guarantees one reward per cycle.
  select id into v_reward_id
  from public.rewards
  where customer_id = p_customer and cycle_number = v_account.cycle_number;
  if found then
    return v_reward_id;
  end if;

  loop
    v_reference := 'RW-' || public.generate_code(8);
    exit when not exists (select 1 from public.rewards where reference = v_reference);
  end loop;

  insert into public.rewards (customer_id, cycle_number, reference, status)
  values (p_customer, v_account.cycle_number, v_reference, 'available')
  returning id into v_reward_id;

  perform public.write_audit(
    p_actor, 'reward.earned', 'reward', v_reward_id::text,
    jsonb_build_object('customer_id', p_customer, 'cycle', v_account.cycle_number, 'reference', v_reference)
  );

  return v_reward_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core point award (internal). One point per business-local day.
-- ---------------------------------------------------------------------------
create or replace function public._award_point(
  p_customer uuid,
  p_location uuid,
  p_qr_session uuid,
  p_method public.visit_method,
  p_recorded_by uuid,
  p_idempotency_key uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.loyalty_accounts;
  v_status public.account_status;
  v_tz text;
  v_today date;
  v_visit public.visits;
  v_reward_id uuid;
  v_new_points integer;
begin
  -- Serialise all point operations for this customer.
  select * into v_account
  from public.loyalty_accounts
  where customer_id = p_customer
  for update;

  if not found then
    return jsonb_build_object('code', 'ACCOUNT_NOT_FOUND');
  end if;

  -- Idempotent replay: the same request key returns the original result.
  if p_idempotency_key is not null then
    select * into v_visit
    from public.visits
    where customer_id = p_customer and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'code', 'POINT_AWARDED',
        'replayed', true,
        'visit_id', v_visit.id,
        'visit_date', v_visit.visit_date,
        'reward_unlocked', exists (
          select 1 from public.rewards
          where customer_id = p_customer and cycle_number = v_visit.cycle_number
        ),
        'account', public.account_snapshot(p_customer)
      );
    end if;
  end if;

  select status into v_status from public.profiles where id = p_customer;
  if v_status is distinct from 'active' then
    return jsonb_build_object('code', 'ACCOUNT_SUSPENDED');
  end if;

  v_tz := public.business_timezone();
  v_today := public.business_date_for(now(), v_tz);

  if exists (select 1 from public.visits where customer_id = p_customer and visit_date = v_today) then
    return jsonb_build_object(
      'code', 'ALREADY_COLLECTED_TODAY',
      'visit_date', v_today,
      'account', public.account_snapshot(p_customer)
    );
  end if;

  if v_account.current_points >= public.points_per_reward()
     or exists (
       select 1 from public.rewards
       where customer_id = p_customer and status in ('available', 'pending')
     ) then
    return jsonb_build_object(
      'code', 'REWARD_PENDING_REDEMPTION',
      'account', public.account_snapshot(p_customer)
    );
  end if;

  begin
    insert into public.visits (
      customer_id, location_id, qr_session_id, method, visit_date,
      business_timezone, cycle_number, recorded_by, idempotency_key, note
    )
    values (
      p_customer, p_location, p_qr_session, p_method, v_today,
      v_tz, v_account.cycle_number, p_recorded_by, p_idempotency_key, p_note
    )
    returning * into v_visit;
  exception when unique_violation then
    return jsonb_build_object(
      'code', 'ALREADY_COLLECTED_TODAY',
      'visit_date', v_today,
      'account', public.account_snapshot(p_customer)
    );
  end;

  v_new_points := v_account.current_points + 1;

  update public.loyalty_accounts
  set current_points = v_new_points,
      total_visits = total_visits + 1
  where customer_id = p_customer;

  insert into public.loyalty_transactions (
    customer_id, cycle_number, type, points_delta, balance_after, visit_id, created_by
  )
  values (
    p_customer, v_account.cycle_number, 'visit', 1, v_new_points, v_visit.id, p_recorded_by
  );

  v_reward_id := public._issue_reward_if_complete(p_customer, p_recorded_by);

  return jsonb_build_object(
    'code', 'POINT_AWARDED',
    'replayed', false,
    'visit_id', v_visit.id,
    'visit_date', v_today,
    'reward_unlocked', v_reward_id is not null,
    'reward_id', v_reward_id,
    'account', public.account_snapshot(p_customer)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- QR sessions
-- ---------------------------------------------------------------------------

-- Called by the server (with the staff member's session) after it generates
-- and signs a token. Only the token hash reaches the database.
create or replace function public.create_qr_session(p_session_id uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.app_settings;
  v_expires timestamptz;
begin
  if auth.uid() is null or not public.is_staff() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;

  select * into v_settings from public.app_settings where id;

  v_expires := now() + make_interval(secs => v_settings.qr_ttl_seconds);

  insert into public.qr_sessions (id, location_id, token_hash, issued_by, expires_at)
  values (p_session_id, v_settings.default_location_id, lower(p_token_hash), auth.uid(), v_expires);

  return jsonb_build_object(
    'code', 'OK',
    'session_id', p_session_id,
    'location_id', v_settings.default_location_id,
    'issued_at', now(),
    'expires_at', v_expires,
    'ttl_seconds', v_settings.qr_ttl_seconds,
    'server_now', clock_timestamp()
  );
end;
$$;

create or replace function public.revoke_qr_sessions(p_session_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;

  update public.qr_sessions
  set revoked_at = now(),
      revoked_by = auth.uid(),
      revoke_reason = left(coalesce(nullif(btrim(p_reason), ''), 'Revoked by administrator'), 280)
  where revoked_at is null
    and expires_at > now()
    and (p_session_id is null or id = p_session_id);

  get diagnostics v_count = row_count;

  perform public.write_audit(
    auth.uid(), 'qr.revoked', 'qr_session', coalesce(p_session_id::text, 'all-active'),
    jsonb_build_object('count', v_count, 'reason', p_reason)
  );

  return jsonb_build_object('code', 'OK', 'revoked', v_count);
end;
$$;

-- Records a verification attempt (including those rejected before the
-- database lookup, such as tampered signatures). Service role only.
create or replace function public.log_scan_attempt(
  p_customer uuid,
  p_session uuid,
  p_code text,
  p_ip_hash text,
  p_user_agent text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.scan_attempts (customer_id, qr_session_id, result_code, ip_hash, user_agent)
  values (p_customer, p_session, left(p_code, 40), left(p_ip_hash, 64), left(p_user_agent, 300))
$$;

-- Verifies a QR session and awards a point. Service role only: the server
-- has already authenticated the customer and verified the token signature.
create or replace function public.award_qr_visit(
  p_customer uuid,
  p_session_id uuid,
  p_token_hash text,
  p_location uuid,
  p_idempotency_key uuid,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.qr_sessions;
  v_location_active boolean;
  v_result jsonb;
  v_existing public.visits;
begin
  -- A retry of a request that already committed returns the original result,
  -- even if the QR code has expired since.
  if p_idempotency_key is not null then
    select * into v_existing
    from public.visits
    where customer_id = p_customer and idempotency_key = p_idempotency_key;
    if found then
      v_result := public._award_point(p_customer, p_location, p_session_id, 'qr', null, p_idempotency_key, null);
      perform public.log_scan_attempt(p_customer, p_session_id, 'POINT_AWARDED_REPLAY', p_ip_hash, p_user_agent);
      return v_result;
    end if;
  end if;

  select * into v_session from public.qr_sessions where id = p_session_id;

  if not found
     or v_session.token_hash <> lower(p_token_hash)
     or v_session.location_id <> p_location then
    v_result := jsonb_build_object('code', 'QR_INVALID');
  elsif v_session.revoked_at is not null then
    v_result := jsonb_build_object('code', 'QR_REVOKED');
  elsif v_session.expires_at <= now() then
    v_result := jsonb_build_object('code', 'QR_EXPIRED');
  else
    select is_active into v_location_active from public.locations where id = v_session.location_id;
    if not coalesce(v_location_active, false) then
      v_result := jsonb_build_object('code', 'QR_INVALID');
    else
      v_result := public._award_point(
        p_customer, v_session.location_id, v_session.id, 'qr', null, p_idempotency_key, null
      );
    end if;
  end if;

  perform public.log_scan_attempt(
    p_customer, p_session_id, v_result ->> 'code', p_ip_hash, p_user_agent
  );

  return v_result;
end;
$$;

-- Staff-assisted check-in for customers who cannot scan.
create or replace function public.staff_check_in(p_customer uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_location uuid;
begin
  if auth.uid() is null or not public.is_staff() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;

  if not exists (select 1 from public.profiles where id = p_customer and role = 'customer') then
    return jsonb_build_object('code', 'CUSTOMER_NOT_FOUND');
  end if;

  select default_location_id into v_location from public.app_settings where id;

  v_result := public._award_point(
    p_customer, v_location, null, 'staff_assisted', auth.uid(), null,
    left(nullif(btrim(coalesce(p_note, '')), ''), 280)
  );

  perform public.write_audit(
    auth.uid(), 'visit.staff_check_in', 'customer', p_customer::text,
    jsonb_build_object('result', v_result ->> 'code', 'note', p_note)
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reward selection and redemption
-- ---------------------------------------------------------------------------

-- Validates customer choices against the drink's permitted customization.
create or replace function public.customizations_valid(p_definition jsonb, p_choices jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_key text;
  v_value jsonb;
  v_group jsonb;
  v_item jsonb;
begin
  if p_choices is null or jsonb_typeof(p_choices) <> 'object' then
    return false;
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_choices) loop
    select g into v_group
    from jsonb_array_elements(p_definition) g
    where g ->> 'name' = v_key;

    if v_group is null then
      return false;
    end if;

    if jsonb_typeof(v_value) = 'string' then
      if not (v_group -> 'options') ? (v_value #>> '{}') then
        return false;
      end if;
    elsif jsonb_typeof(v_value) = 'array' and coalesce((v_group ->> 'multi')::boolean, false) then
      for v_item in select * from jsonb_array_elements(v_value) loop
        if jsonb_typeof(v_item) <> 'string' or not (v_group -> 'options') ? (v_item #>> '{}') then
          return false;
        end if;
      end loop;
    else
      return false;
    end if;
    v_group := null;
  end loop;

  return true;
end;
$$;

create or replace function public.select_reward_drink(
  p_reward_id uuid,
  p_drink_id uuid,
  p_customizations jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_reward public.rewards;
  v_drink public.drinks;
  v_reference text;
  v_redemption_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHENTICATED');
  end if;

  if exists (select 1 from public.profiles where id = v_uid and status <> 'active') then
    return jsonb_build_object('code', 'ACCOUNT_SUSPENDED');
  end if;

  select * into v_reward from public.rewards where id = p_reward_id for update;

  if not found or v_reward.customer_id <> v_uid then
    return jsonb_build_object('code', 'REWARD_NOT_FOUND');
  end if;

  if v_reward.status <> 'available' then
    return jsonb_build_object('code', 'REWARD_NOT_AVAILABLE', 'status', v_reward.status);
  end if;

  if v_reward.expires_at is not null and v_reward.expires_at <= now() then
    return jsonb_build_object('code', 'REWARD_EXPIRED');
  end if;

  select * into v_drink from public.drinks where id = p_drink_id;
  if not found or not v_drink.is_active or not v_drink.is_reward_eligible then
    return jsonb_build_object('code', 'DRINK_NOT_ELIGIBLE');
  end if;

  if not public.customizations_valid(v_drink.customization, coalesce(p_customizations, '{}'::jsonb)) then
    return jsonb_build_object('code', 'INVALID_CUSTOMIZATION');
  end if;

  loop
    v_reference := 'PB-' || public.generate_code(6);
    exit when not exists (select 1 from public.redemptions where reference = v_reference);
  end loop;

  insert into public.redemptions (reward_id, customer_id, drink_id, drink_name, customizations, reference)
  values (v_reward.id, v_uid, v_drink.id, v_drink.name, coalesce(p_customizations, '{}'::jsonb), v_reference)
  returning id into v_redemption_id;

  update public.rewards set status = 'pending' where id = v_reward.id;

  perform public.write_audit(
    v_uid, 'redemption.requested', 'redemption', v_redemption_id::text,
    jsonb_build_object('reward_id', v_reward.id, 'drink', v_drink.name, 'reference', v_reference)
  );

  return jsonb_build_object(
    'code', 'REDEMPTION_REQUESTED',
    'redemption_id', v_redemption_id,
    'reference', v_reference,
    'drink_name', v_drink.name
  );
end;
$$;

-- Staff lookup of a redemption reference.
create or replace function public.lookup_redemption(p_reference text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
begin
  if auth.uid() is null or not public.is_staff() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;

  select r.id, r.reference, r.status, r.drink_name, r.customizations, r.requested_at,
         r.completed_at, r.cancelled_at, r.cancel_reason,
         rw.reference as reward_reference, rw.status as reward_status, rw.cycle_number,
         rw.customer_id = r.customer_id as ownership_ok,
         p.full_name, p.phone, p.email, p.status as account_status,
         a.current_points
  into v_row
  from public.redemptions r
  join public.rewards rw on rw.id = r.reward_id
  join public.profiles p on p.id = r.customer_id
  join public.loyalty_accounts a on a.customer_id = r.customer_id
  where r.reference = upper(btrim(p_reference));

  if not found then
    return jsonb_build_object('code', 'REDEMPTION_NOT_FOUND');
  end if;

  return jsonb_build_object(
    'code', 'OK',
    'redemption', jsonb_build_object(
      'id', v_row.id,
      'reference', v_row.reference,
      'status', v_row.status,
      'drink_name', v_row.drink_name,
      'customizations', v_row.customizations,
      'requested_at', v_row.requested_at,
      'completed_at', v_row.completed_at,
      'cancelled_at', v_row.cancelled_at,
      'cancel_reason', v_row.cancel_reason,
      'reward_reference', v_row.reward_reference,
      'reward_status', v_row.reward_status,
      'cycle_number', v_row.cycle_number,
      'ownership_ok', v_row.ownership_ok,
      'customer_name', v_row.full_name,
      'customer_phone_last4', right(coalesce(v_row.phone, ''), 4),
      'account_status', v_row.account_status,
      'current_points', v_row.current_points
    )
  );
end;
$$;

-- Staff confirms the drink was served. Marks the reward redeemed and resets
-- the balance to zero in one atomic transaction.
create or replace function public.complete_redemption(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff uuid := auth.uid();
  v_redemption public.redemptions;
  v_reward public.rewards;
  v_account public.loyalty_accounts;
  v_customer_status public.account_status;
begin
  if v_staff is null or not public.is_staff() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;

  select * into v_redemption
  from public.redemptions
  where reference = upper(btrim(p_reference))
  for update;

  if not found then
    return jsonb_build_object('code', 'REDEMPTION_NOT_FOUND');
  end if;
  if v_redemption.status = 'completed' then
    return jsonb_build_object('code', 'ALREADY_REDEEMED', 'completed_at', v_redemption.completed_at);
  end if;
  if v_redemption.status = 'cancelled' then
    return jsonb_build_object('code', 'REDEMPTION_CANCELLED');
  end if;

  select * into v_reward from public.rewards where id = v_redemption.reward_id for update;

  if v_reward.customer_id <> v_redemption.customer_id then
    return jsonb_build_object('code', 'OWNERSHIP_MISMATCH');
  end if;
  if v_reward.status <> 'pending' then
    return jsonb_build_object('code', 'REWARD_NOT_PENDING', 'status', v_reward.status);
  end if;
  if v_reward.expires_at is not null and v_reward.expires_at <= now() then
    return jsonb_build_object('code', 'REWARD_EXPIRED');
  end if;

  select status into v_customer_status from public.profiles where id = v_redemption.customer_id;
  if v_customer_status <> 'active' then
    return jsonb_build_object('code', 'ACCOUNT_SUSPENDED');
  end if;

  select * into v_account
  from public.loyalty_accounts
  where customer_id = v_redemption.customer_id
  for update;

  update public.redemptions
  set status = 'completed', completed_at = now(), completed_by = v_staff
  where id = v_redemption.id;

  update public.rewards
  set status = 'redeemed', redeemed_at = now()
  where id = v_reward.id;

  update public.loyalty_accounts
  set current_points = 0,
      cycle_number = cycle_number + 1,
      rewards_redeemed = rewards_redeemed + 1
  where customer_id = v_redemption.customer_id;

  insert into public.loyalty_transactions (
    customer_id, cycle_number, type, points_delta, balance_after,
    reward_id, redemption_id, reason, created_by
  )
  values (
    v_redemption.customer_id, v_account.cycle_number, 'redemption_reset',
    -v_account.current_points, 0, v_reward.id, v_redemption.id,
    'Reward redeemed: ' || v_redemption.drink_name, v_staff
  );

  perform public.write_audit(
    v_staff, 'redemption.completed', 'redemption', v_redemption.id::text,
    jsonb_build_object(
      'reference', v_redemption.reference,
      'customer_id', v_redemption.customer_id,
      'drink', v_redemption.drink_name,
      'cycle', v_account.cycle_number,
      'points_before', v_account.current_points
    )
  );

  return jsonb_build_object(
    'code', 'REDEMPTION_COMPLETED',
    'reference', v_redemption.reference,
    'drink_name', v_redemption.drink_name,
    'completed_at', now(),
    'new_cycle', v_account.cycle_number + 1
  );
end;
$$;

-- Cancels a pending redemption request. The reward stays earned and returns
-- to 'available'. Allowed for staff, or for the customer who made it.
create or replace function public.cancel_redemption(p_reference text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_redemption public.redemptions;
  v_is_staff boolean := public.is_staff();
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHENTICATED');
  end if;

  select * into v_redemption
  from public.redemptions
  where reference = upper(btrim(p_reference))
  for update;

  if not found or (not v_is_staff and v_redemption.customer_id <> v_uid) then
    return jsonb_build_object('code', 'REDEMPTION_NOT_FOUND');
  end if;
  if v_redemption.status <> 'pending' then
    return jsonb_build_object('code', 'REDEMPTION_NOT_PENDING', 'status', v_redemption.status);
  end if;

  perform 1 from public.rewards where id = v_redemption.reward_id for update;

  update public.redemptions
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid,
      cancel_reason = left(coalesce(nullif(btrim(p_reason), ''), 'Cancelled'), 280)
  where id = v_redemption.id;

  update public.rewards
  set status = 'available'
  where id = v_redemption.reward_id and status = 'pending';

  perform public.write_audit(
    v_uid, 'redemption.cancelled', 'redemption', v_redemption.id::text,
    jsonb_build_object('reference', v_redemption.reference, 'reason', p_reason, 'by_staff', v_is_staff)
  );

  return jsonb_build_object('code', 'REDEMPTION_CANCELLED', 'reference', v_redemption.reference);
end;
$$;

-- ---------------------------------------------------------------------------
-- Administrator operations
-- ---------------------------------------------------------------------------
create or replace function public.admin_adjust_points(p_customer uuid, p_delta integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_account public.loyalty_accounts;
  v_new integer;
  v_reward_id uuid;
begin
  if v_admin is null or not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if p_delta is null or p_delta = 0 or p_delta not between -15 and 15 then
    return jsonb_build_object('code', 'INVALID_ADJUSTMENT', 'message', 'Adjustment must be between -15 and 15 and not zero.');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    return jsonb_build_object('code', 'REASON_REQUIRED');
  end if;

  select * into v_account from public.loyalty_accounts where customer_id = p_customer for update;
  if not found then
    return jsonb_build_object('code', 'CUSTOMER_NOT_FOUND');
  end if;

  if exists (select 1 from public.rewards where customer_id = p_customer and status in ('available', 'pending')) then
    return jsonb_build_object('code', 'REWARD_PENDING_REDEMPTION');
  end if;

  v_new := v_account.current_points + p_delta;
  if v_new < 0 or v_new > public.points_per_reward() then
    return jsonb_build_object('code', 'INVALID_ADJUSTMENT', 'message', 'Resulting balance must be between 0 and 15.');
  end if;

  update public.loyalty_accounts set current_points = v_new where customer_id = p_customer;

  insert into public.loyalty_transactions (
    customer_id, cycle_number, type, points_delta, balance_after, reason, created_by
  )
  values (p_customer, v_account.cycle_number, 'manual_adjustment', p_delta, v_new, btrim(p_reason), v_admin);

  perform public.write_audit(
    v_admin, 'points.adjusted', 'customer', p_customer::text,
    jsonb_build_object('delta', p_delta, 'before', v_account.current_points, 'after', v_new, 'reason', btrim(p_reason))
  );

  v_reward_id := public._issue_reward_if_complete(p_customer, v_admin);

  return jsonb_build_object(
    'code', 'OK',
    'reward_unlocked', v_reward_id is not null,
    'account', public.account_snapshot(p_customer)
  );
end;
$$;

create or replace function public.admin_set_account_status(
  p_user uuid,
  p_status public.account_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_before public.account_status;
begin
  if v_admin is null or not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if p_user = v_admin then
    return jsonb_build_object('code', 'CANNOT_CHANGE_SELF');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    return jsonb_build_object('code', 'REASON_REQUIRED');
  end if;

  select status into v_before from public.profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('code', 'CUSTOMER_NOT_FOUND');
  end if;

  update public.profiles set status = p_status where id = p_user;

  perform public.write_audit(
    v_admin, 'account.status_changed', 'profile', p_user::text,
    jsonb_build_object('before', v_before, 'after', p_status, 'reason', btrim(p_reason))
  );

  return jsonb_build_object('code', 'OK', 'status', p_status);
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role public.user_role)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_before public.user_role;
begin
  if v_admin is null or not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if p_user = v_admin then
    return jsonb_build_object('code', 'CANNOT_CHANGE_SELF');
  end if;

  select role into v_before from public.profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('code', 'CUSTOMER_NOT_FOUND');
  end if;

  update public.profiles set role = p_role where id = p_user;

  perform public.write_audit(
    v_admin, 'account.role_changed', 'profile', p_user::text,
    jsonb_build_object('before', v_before, 'after', p_role)
  );

  return jsonb_build_object('code', 'OK', 'role', p_role);
end;
$$;

-- Voids an open reward (for example after fraud investigation). The customer
-- starts a new cycle at zero; the voided reward stays in history.
create or replace function public.admin_cancel_reward(p_reward_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_reward public.rewards;
  v_account public.loyalty_accounts;
begin
  if v_admin is null or not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    return jsonb_build_object('code', 'REASON_REQUIRED');
  end if;

  select * into v_reward from public.rewards where id = p_reward_id for update;
  if not found then
    return jsonb_build_object('code', 'REWARD_NOT_FOUND');
  end if;
  if v_reward.status not in ('available', 'pending') then
    return jsonb_build_object('code', 'REWARD_NOT_AVAILABLE', 'status', v_reward.status);
  end if;

  select * into v_account from public.loyalty_accounts where customer_id = v_reward.customer_id for update;

  update public.redemptions
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_admin,
      cancel_reason = 'Reward voided: ' || left(btrim(p_reason), 200)
  where reward_id = v_reward.id and status = 'pending';

  update public.rewards
  set status = 'cancelled', cancelled_at = now(), cancel_reason = left(btrim(p_reason), 280)
  where id = v_reward.id;

  if v_account.cycle_number = v_reward.cycle_number then
    update public.loyalty_accounts
    set current_points = 0, cycle_number = cycle_number + 1
    where customer_id = v_reward.customer_id;

    insert into public.loyalty_transactions (
      customer_id, cycle_number, type, points_delta, balance_after, reward_id, reason, created_by
    )
    values (
      v_reward.customer_id, v_account.cycle_number, 'reward_cancelled_reset',
      -v_account.current_points, 0, v_reward.id, btrim(p_reason), v_admin
    );
  end if;

  perform public.write_audit(
    v_admin, 'reward.cancelled', 'reward', v_reward.id::text,
    jsonb_build_object('customer_id', v_reward.customer_id, 'reason', btrim(p_reason))
  );

  return jsonb_build_object('code', 'OK');
end;
$$;

create or replace function public.admin_update_settings(p_timezone text, p_qr_ttl_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_before public.app_settings;
begin
  if v_admin is null or not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    return jsonb_build_object('code', 'INVALID_TIMEZONE');
  end if;
  if p_qr_ttl_seconds is null or p_qr_ttl_seconds not between 30 and 300 then
    return jsonb_build_object('code', 'INVALID_TTL');
  end if;

  select * into v_before from public.app_settings where id for update;

  update public.app_settings
  set business_timezone = p_timezone,
      qr_ttl_seconds = p_qr_ttl_seconds,
      updated_at = now(),
      updated_by = v_admin
  where id;

  perform public.write_audit(
    v_admin, 'settings.updated', 'app_settings', 'global',
    jsonb_build_object(
      'before', jsonb_build_object('timezone', v_before.business_timezone, 'qr_ttl', v_before.qr_ttl_seconds),
      'after', jsonb_build_object('timezone', p_timezone, 'qr_ttl', p_qr_ttl_seconds)
    )
  );

  return jsonb_build_object('code', 'OK');
end;
$$;

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
     or (char_length(v_digits) >= 3 and position(v_digits in coalesce(p.phone, '')) > 0)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_tz text;
begin
  if auth.uid() is null or not public.is_staff() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;

  v_tz := public.business_timezone();
  v_today := public.business_date_for(now(), v_tz);

  return jsonb_build_object(
    'code', 'OK',
    'business_date', v_today,
    'business_timezone', v_tz,
    'total_customers', (select count(*) from public.profiles where role = 'customer'),
    'visited_today', (select count(distinct customer_id) from public.visits where visit_date = v_today),
    'total_visits', (select count(*) from public.visits),
    'points_today', (
      select coalesce(sum(points_delta), 0) from public.loyalty_transactions
      where type = 'visit' and public.business_date_for(created_at, v_tz) = v_today
    ),
    'available_rewards', (select count(*) from public.rewards where status = 'available'),
    'pending_redemptions', (select count(*) from public.redemptions where status = 'pending'),
    'redeemed_today', (
      select count(*) from public.redemptions
      where status = 'completed' and public.business_date_for(completed_at, v_tz) = v_today
    ),
    'failed_scans_today', (
      select count(*) from public.scan_attempts
      where result_code not like 'POINT_AWARDED%'
        and public.business_date_for(created_at, v_tz) = v_today
    )
  );
end;
$$;

-- Fixed window rate limiter. Service role only.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into public.rate_limits (bucket_key, window_start, hits)
  values (left(p_key, 200), v_window, 1)
  on conflict (bucket_key, window_start)
  do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup of old windows.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- Initial administrator bootstrap. Not callable through the API; run it from
-- the Supabase SQL editor or with the service role script.
create or replace function public.promote_to_admin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.profiles set role = 'admin', status = 'active'
  where email = lower(btrim(p_email))
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('code', 'CUSTOMER_NOT_FOUND');
  end if;

  perform public.write_audit(null, 'account.bootstrap_admin', 'profile', v_id::text,
    jsonb_build_object('email', lower(btrim(p_email))));

  return jsonb_build_object('code', 'OK', 'user_id', v_id);
end;
$$;

-- ===================== 20261019000300_security.sql =====================
-- Palm Bite Loyalty: Row Level Security, grants and function permissions.
-- Clients get read access to their own rows only. Every write to loyalty
-- data happens inside the security definer functions defined earlier.

-- ---------------------------------------------------------------------------
-- Start from zero privileges for API roles
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter table public.locations enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.qr_sessions enable row level security;
alter table public.visits enable row level security;
alter table public.rewards enable row level security;
alter table public.drinks enable row level security;
alter table public.redemptions enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.scan_attempts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- Policy helper functions must be executable by API roles.
-- anon needs these too: the drinks and storage policies call is_admin(),
-- which simply returns false when there is no signed-in user.
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.points_per_reward() to anon, authenticated;
grant execute on function public.business_date_for(timestamptz, text) to authenticated;
grant execute on function public.business_today() to authenticated;
grant execute on function public.business_timezone() to authenticated;

-- ---------------------------------------------------------------------------
-- Locations and settings
-- ---------------------------------------------------------------------------
grant select on public.locations to anon, authenticated;
create policy locations_read on public.locations
  for select to anon, authenticated using (true);

grant select on public.app_settings to authenticated;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Profiles: customers read and edit their own name and phone only.
-- Role, status and email cannot be changed through the API.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy profiles_read_own_or_staff on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() and status = 'active')
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Loyalty data: read own (customers) or all (staff and admins). No writes.
-- ---------------------------------------------------------------------------
grant select on public.loyalty_accounts to authenticated;
create policy loyalty_accounts_read on public.loyalty_accounts
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.visits to authenticated;
create policy visits_read on public.visits
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.loyalty_transactions to authenticated;
create policy loyalty_transactions_read on public.loyalty_transactions
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.rewards to authenticated;
create policy rewards_read on public.rewards
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.redemptions to authenticated;
create policy redemptions_read on public.redemptions
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Drinks: everyone reads active drinks; administrators manage the menu.
-- ---------------------------------------------------------------------------
grant select on public.drinks to anon, authenticated;
grant insert, update, delete on public.drinks to authenticated;

create policy drinks_read on public.drinks
  for select to anon, authenticated
  using (is_active or public.is_admin());

create policy drinks_admin_insert on public.drinks
  for insert to authenticated with check (public.is_admin());

create policy drinks_admin_update on public.drinks
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy drinks_admin_delete on public.drinks
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- QR sessions, scan attempts and audit logs
-- ---------------------------------------------------------------------------
grant select on public.qr_sessions to authenticated;
create policy qr_sessions_staff_read on public.qr_sessions
  for select to authenticated using (public.is_staff());

grant select on public.scan_attempts to authenticated;
create policy scan_attempts_admin_read on public.scan_attempts
  for select to authenticated using (public.is_admin());

grant select on public.audit_logs to authenticated;
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (public.is_admin());

-- rate_limits: no API access at all (RLS enabled, no policies, no grants).

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------
-- Authenticated users (each function checks the caller's role internally).
grant execute on function public.select_reward_drink(uuid, uuid, jsonb) to authenticated;
grant execute on function public.cancel_redemption(text, text) to authenticated;
grant execute on function public.lookup_redemption(text) to authenticated;
grant execute on function public.complete_redemption(text) to authenticated;
grant execute on function public.staff_check_in(uuid, text) to authenticated;
grant execute on function public.create_qr_session(uuid, text) to authenticated;
grant execute on function public.revoke_qr_sessions(uuid, text) to authenticated;
grant execute on function public.admin_adjust_points(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
grant execute on function public.admin_cancel_reward(uuid, text) to authenticated;
grant execute on function public.admin_update_settings(text, integer) to authenticated;
grant execute on function public.admin_search_customers(text, integer, integer) to authenticated;
grant execute on function public.admin_overview() to authenticated;

-- Server only (service role). These trust the server's authentication and
-- token signature checks, so they must never be reachable by clients.
grant execute on function public.award_qr_visit(uuid, uuid, text, uuid, uuid, text, text) to service_role;
grant execute on function public.log_scan_attempt(uuid, uuid, text, text, text) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.registration_conflicts(text, text) to service_role;
grant execute on function public.promote_to_admin(text) to service_role;

-- Internal functions stay private (no grants):
-- _award_point, _issue_reward_if_complete, write_audit, account_snapshot,
-- generate_code, customizations_valid, handle_new_user.

-- Ensure functions created later are not executable by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ===================== 20261019000400_storage.sql =====================
-- Palm Bite Loyalty: drink image storage.
-- Public read (menu photography), administrator write. 4 MB limit, images only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drink-images', 'drink-images', true, 4194304, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy drink_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'drink-images');

create policy drink_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'drink-images' and public.is_admin());

create policy drink_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'drink-images' and public.is_admin())
  with check (bucket_id = 'drink-images' and public.is_admin());

create policy drink_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'drink-images' and public.is_admin());

-- ===================== 20261019000500_reports.sql =====================
-- Palm Bite Loyalty: administrator reports.
-- Every report is computed from live tables at request time. Date filters are
-- inclusive and interpreted in the configured business timezone.

create or replace function public.admin_report(p_kind text, p_from date, p_to date)
returns setof jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz text := public.business_timezone();
  v_from date := coalesce(p_from, date '2000-01-01');
  v_to date := coalesce(p_to, date '2999-12-31');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  -- Every access to customer data exports is recorded.
  perform public.write_audit(
    auth.uid(), 'report.viewed', 'report', p_kind,
    jsonb_build_object('from', p_from, 'to', p_to)
  );

  if p_kind = 'customers' then
    return query
    select jsonb_build_object(
      'customer_id', p.id, 'full_name', p.full_name, 'phone', p.phone, 'email', p.email,
      'status', p.status, 'registered_on', public.business_date_for(p.created_at, v_tz),
      'current_points', a.current_points, 'cycle', a.cycle_number,
      'total_visits', a.total_visits, 'rewards_redeemed', a.rewards_redeemed
    )
    from public.profiles p join public.loyalty_accounts a on a.customer_id = p.id
    where p.role = 'customer'
      and public.business_date_for(p.created_at, v_tz) between v_from and v_to
    order by p.created_at;

  elsif p_kind = 'visits' then
    return query
    select jsonb_build_object(
      'visit_date', v.visit_date, 'recorded_at', v.created_at, 'customer_id', v.customer_id,
      'full_name', p.full_name, 'method', v.method, 'cycle', v.cycle_number,
      'recorded_by', s.full_name
    )
    from public.visits v
    join public.profiles p on p.id = v.customer_id
    left join public.profiles s on s.id = v.recorded_by
    where v.visit_date between v_from and v_to
    order by v.created_at;

  elsif p_kind = 'daily_visits' then
    return query
    select jsonb_build_object(
      'visit_date', d.visit_date, 'verified_visits', d.visits,
      'qr_visits', d.qr, 'staff_assisted_visits', d.staff
    )
    from (
      select visit_date, count(*) as visits,
             count(*) filter (where method = 'qr') as qr,
             count(*) filter (where method = 'staff_assisted') as staff
      from public.visits
      where visit_date between v_from and v_to
      group by visit_date
    ) d
    order by d.visit_date;

  elsif p_kind = 'points' then
    return query
    select jsonb_build_object(
      'created_at', t.created_at, 'business_date', public.business_date_for(t.created_at, v_tz),
      'customer_id', t.customer_id, 'full_name', p.full_name, 'type', t.type,
      'points_delta', t.points_delta, 'balance_after', t.balance_after, 'cycle', t.cycle_number,
      'reason', t.reason
    )
    from public.loyalty_transactions t join public.profiles p on p.id = t.customer_id
    where public.business_date_for(t.created_at, v_tz) between v_from and v_to
    order by t.created_at;

  elsif p_kind = 'balances' then
    return query
    select jsonb_build_object(
      'customer_id', p.id, 'full_name', p.full_name, 'phone', p.phone,
      'current_points', a.current_points, 'cycle', a.cycle_number,
      'open_reward', (select r.status from public.rewards r
                      where r.customer_id = p.id and r.status in ('available', 'pending') limit 1),
      'updated_at', a.updated_at
    )
    from public.profiles p join public.loyalty_accounts a on a.customer_id = p.id
    where p.role = 'customer'
    order by a.current_points desc, p.full_name;

  elsif p_kind = 'rewards_earned' then
    return query
    select jsonb_build_object(
      'reference', r.reference, 'earned_at', r.earned_at, 'customer_id', r.customer_id,
      'full_name', p.full_name, 'cycle', r.cycle_number, 'status', r.status
    )
    from public.rewards r join public.profiles p on p.id = r.customer_id
    where public.business_date_for(r.earned_at, v_tz) between v_from and v_to
    order by r.earned_at;

  elsif p_kind = 'rewards_redeemed' then
    return query
    select jsonb_build_object(
      'reference', d.reference, 'completed_at', d.completed_at, 'customer_id', d.customer_id,
      'full_name', p.full_name, 'drink', d.drink_name, 'customizations', d.customizations,
      'served_by', s.full_name
    )
    from public.redemptions d
    join public.profiles p on p.id = d.customer_id
    left join public.profiles s on s.id = d.completed_by
    where d.status = 'completed'
      and public.business_date_for(d.completed_at, v_tz) between v_from and v_to
    order by d.completed_at;

  elsif p_kind = 'pending_redemptions' then
    return query
    select jsonb_build_object(
      'reference', d.reference, 'requested_at', d.requested_at, 'customer_id', d.customer_id,
      'full_name', p.full_name, 'drink', d.drink_name, 'customizations', d.customizations
    )
    from public.redemptions d join public.profiles p on p.id = d.customer_id
    where d.status = 'pending'
    order by d.requested_at;

  elsif p_kind = 'adjustments' then
    return query
    select jsonb_build_object(
      'created_at', t.created_at, 'customer_id', t.customer_id, 'full_name', p.full_name,
      'points_delta', t.points_delta, 'balance_after', t.balance_after, 'reason', t.reason,
      'adjusted_by', s.full_name
    )
    from public.loyalty_transactions t
    join public.profiles p on p.id = t.customer_id
    left join public.profiles s on s.id = t.created_by
    where t.type = 'manual_adjustment'
      and public.business_date_for(t.created_at, v_tz) between v_from and v_to
    order by t.created_at;

  else
    raise exception 'Unknown report: %', p_kind using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.admin_report(text, date, date) from public, anon, authenticated;
grant execute on function public.admin_report(text, date, date) to authenticated;

-- ===================== 20261112000600_staff_approval.sql =====================
-- Palm Bite Loyalty: Palm Fren / Palm Staff accounts and staff-approved visits.
--
-- 1. At sign-up a person chooses Palm Fren (customer) or Palm Staff (worker).
--    Choosing Palm Staff only creates a request; an administrator approves it.
-- 2. Each visit QR code is single-use: the first Palm Fren to scan it claims
--    it, and the display immediately shows a new code.
-- 3. A scan creates a pending visit request. The point is added only when a
--    Palm Staff member approves it.

-- ---------------------------------------------------------------------------
-- Staff requests on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists staff_request text
    check (staff_request is null or staff_request in ('pending', 'approved', 'declined')),
  add column if not exists staff_requested_at timestamptz;

create index if not exists profiles_staff_request_idx on public.profiles (staff_request)
  where staff_request = 'pending';

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
begin
  if char_length(v_name) < 2 then
    v_name := split_part(coalesce(new.email, 'Palm Bite Guest'), '@', 1);
    if char_length(v_name) < 2 then
      v_name := 'Palm Bite Guest';
    end if;
  end if;

  -- Everyone starts as a customer. A staff request never grants access by itself.
  insert into public.profiles (id, full_name, phone, email, role, staff_request, staff_requested_at)
  values (
    new.id, left(v_name, 80), v_phone, lower(new.email), 'customer',
    case when v_wants_staff then 'pending' end,
    case when v_wants_staff then now() end
  );

  insert into public.loyalty_accounts (customer_id, current_points, cycle_number)
  values (new.id, 0, 1);

  return new;
end;
$$;

create or replace function public.admin_decide_staff_request(p_user uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_admin is null or not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;

  select * into v_profile from public.profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('code', 'CUSTOMER_NOT_FOUND');
  end if;
  if v_profile.staff_request is distinct from 'pending' then
    return jsonb_build_object('code', 'NO_PENDING_REQUEST');
  end if;

  if p_approve then
    update public.profiles
    set staff_request = 'approved',
        role = case when role = 'admin' then role else 'staff' end
    where id = p_user;
  else
    update public.profiles set staff_request = 'declined' where id = p_user;
  end if;

  perform public.write_audit(
    v_admin, case when p_approve then 'staff_request.approved' else 'staff_request.declined' end,
    'profile', p_user::text, jsonb_build_object('name', v_profile.full_name)
  );

  return jsonb_build_object('code', 'OK');
end;
$$;

-- ---------------------------------------------------------------------------
-- Single-use QR sessions
-- ---------------------------------------------------------------------------
alter table public.qr_sessions
  add column if not exists consumed_at timestamptz,
  add column if not exists consumed_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Visit requests awaiting Palm Staff approval
-- ---------------------------------------------------------------------------
create table if not exists public.visit_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  qr_session_id uuid not null unique references public.qr_sessions (id) on delete cascade,
  location_id uuid not null references public.locations (id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  result_code text,
  idempotency_key uuid,
  visit_id uuid references public.visits (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint visit_requests_idempotency unique (customer_id, idempotency_key)
);

create unique index if not exists visit_requests_one_pending_per_customer
  on public.visit_requests (customer_id) where status = 'pending';
create index if not exists visit_requests_status_idx on public.visit_requests (status, created_at desc);

alter table public.visit_requests enable row level security;
revoke all on public.visit_requests from anon, authenticated;
grant select on public.visit_requests to authenticated;

drop policy if exists visit_requests_read on public.visit_requests;
create policy visit_requests_read on public.visit_requests
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

-- How long a scan waits for approval before it lapses.
create or replace function public.visit_request_ttl()
returns interval
language sql
immutable
as $$ select interval '15 minutes' $$;

-- Maps a request to the code the customer sees.
create or replace function public._visit_request_code(p_request public.visit_requests)
returns text
language sql
stable
as $$
  select case
    when p_request.status = 'pending' and p_request.created_at <= now() - public.visit_request_ttl() then 'REQUEST_EXPIRED'
    when p_request.status = 'pending' then 'APPROVAL_PENDING'
    when p_request.status = 'approved' then 'POINT_AWARDED'
    when p_request.status = 'expired' then 'REQUEST_EXPIRED'
    when p_request.result_code in ('ALREADY_COLLECTED_TODAY', 'REWARD_PENDING_REDEMPTION', 'ACCOUNT_SUSPENDED') then p_request.result_code
    else 'VISIT_REJECTED'
  end
$$;

-- ---------------------------------------------------------------------------
-- Customer scan: validates the code and creates a pending request.
-- Service role only (the server has authenticated the customer and checked
-- the token signature).
-- ---------------------------------------------------------------------------
create or replace function public.request_qr_visit(
  p_customer uuid,
  p_session_id uuid,
  p_token_hash text,
  p_location uuid,
  p_idempotency_key uuid,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.loyalty_accounts;
  v_status public.account_status;
  v_session public.qr_sessions;
  v_request public.visit_requests;
  v_today date;
  v_result jsonb;
begin
  -- Serialise this customer's scans.
  select * into v_account from public.loyalty_accounts where customer_id = p_customer for update;
  if not found then
    return jsonb_build_object('code', 'UNAUTHENTICATED');
  end if;

  -- A retry of a request that already reached the database.
  if p_idempotency_key is not null then
    select * into v_request from public.visit_requests
    where customer_id = p_customer and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('code', public._visit_request_code(v_request), 'request_id', v_request.id,
                                'account', public.account_snapshot(p_customer));
    end if;
  end if;

  select * into v_session from public.qr_sessions where id = p_session_id for update;

  if not found or v_session.token_hash <> lower(p_token_hash) or v_session.location_id <> p_location then
    v_result := jsonb_build_object('code', 'QR_INVALID');
  elsif v_session.revoked_at is not null then
    v_result := jsonb_build_object('code', 'QR_REVOKED');
  elsif v_session.consumed_at is not null then
    -- The same guest scanning the code they already used sees their request.
    select * into v_request from public.visit_requests where qr_session_id = v_session.id;
    if found and v_request.customer_id = p_customer then
      v_result := jsonb_build_object('code', public._visit_request_code(v_request), 'request_id', v_request.id);
      if v_request.status = 'approved' then
        v_result := jsonb_build_object('code', 'ALREADY_COLLECTED_TODAY', 'request_id', v_request.id);
      end if;
    else
      v_result := jsonb_build_object('code', 'QR_USED');
    end if;
  elsif v_session.expires_at <= now() then
    v_result := jsonb_build_object('code', 'QR_EXPIRED');
  else
    select status into v_status from public.profiles where id = p_customer;
    v_today := public.business_today();

    if v_status is distinct from 'active' then
      v_result := jsonb_build_object('code', 'ACCOUNT_SUSPENDED');
    elsif exists (select 1 from public.visits where customer_id = p_customer and visit_date = v_today) then
      v_result := jsonb_build_object('code', 'ALREADY_COLLECTED_TODAY');
    elsif v_account.current_points >= public.points_per_reward()
       or exists (select 1 from public.rewards where customer_id = p_customer and status in ('available', 'pending')) then
      v_result := jsonb_build_object('code', 'REWARD_PENDING_REDEMPTION');
    else
      -- Replace any earlier pending request from this guest.
      update public.visit_requests
      set status = 'expired', result_code = 'REPLACED', decided_at = now()
      where customer_id = p_customer and status = 'pending';

      insert into public.visit_requests (customer_id, qr_session_id, location_id, idempotency_key)
      values (p_customer, v_session.id, v_session.location_id, p_idempotency_key)
      returning * into v_request;

      update public.qr_sessions set consumed_at = now(), consumed_by = p_customer where id = v_session.id;

      v_result := jsonb_build_object('code', 'APPROVAL_PENDING', 'request_id', v_request.id);
    end if;
  end if;

  perform public.log_scan_attempt(p_customer, p_session_id, v_result ->> 'code', p_ip_hash, p_user_agent);

  return v_result || jsonb_build_object('account', public.account_snapshot(p_customer));
end;
$$;

-- ---------------------------------------------------------------------------
-- Palm Staff approve or decline a pending visit.
-- ---------------------------------------------------------------------------
create or replace function public.staff_decide_visit(p_request uuid, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff uuid := auth.uid();
  v_request public.visit_requests;
  v_result jsonb;
  v_name text;
begin
  if v_staff is null or not public.is_staff() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;

  select * into v_request from public.visit_requests where id = p_request for update;
  if not found then
    return jsonb_build_object('code', 'REQUEST_NOT_FOUND');
  end if;
  if v_request.status <> 'pending' then
    return jsonb_build_object('code', 'ALREADY_DECIDED', 'status', v_request.status);
  end if;

  select full_name into v_name from public.profiles where id = v_request.customer_id;

  if v_request.created_at <= now() - public.visit_request_ttl() then
    update public.visit_requests set status = 'expired', result_code = 'REQUEST_EXPIRED', decided_at = now()
    where id = v_request.id;
    return jsonb_build_object('code', 'REQUEST_EXPIRED');
  end if;

  if not p_approve then
    update public.visit_requests
    set status = 'rejected', result_code = 'DECLINED_BY_STAFF', decided_by = v_staff, decided_at = now()
    where id = v_request.id;
    perform public.write_audit(v_staff, 'visit.declined', 'customer', v_request.customer_id::text,
      jsonb_build_object('request_id', v_request.id));
    return jsonb_build_object('code', 'VISIT_DECLINED', 'customer_name', v_name);
  end if;

  -- The request id doubles as the idempotency key, so a request can never
  -- produce two visits.
  v_result := public._award_point(
    v_request.customer_id, v_request.location_id, v_request.qr_session_id, 'qr', v_staff, v_request.id, null
  );

  if v_result ->> 'code' = 'POINT_AWARDED' then
    update public.visit_requests
    set status = 'approved', result_code = 'POINT_AWARDED', visit_id = (v_result ->> 'visit_id')::uuid,
        decided_by = v_staff, decided_at = now()
    where id = v_request.id;
  else
    update public.visit_requests
    set status = 'rejected', result_code = v_result ->> 'code', decided_by = v_staff, decided_at = now()
    where id = v_request.id;
  end if;

  perform public.write_audit(v_staff, 'visit.approved', 'customer', v_request.customer_id::text,
    jsonb_build_object('request_id', v_request.id, 'result', v_result ->> 'code'));

  return v_result || jsonb_build_object('customer_name', v_name);
end;
$$;

-- The old direct-award scan is replaced by request_qr_visit + approval.
drop function if exists public.award_qr_visit(uuid, uuid, text, uuid, uuid, text, text);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_decide_staff_request(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.request_qr_visit(uuid, uuid, text, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.staff_decide_visit(uuid, boolean) from public, anon, authenticated;
revoke execute on function public._visit_request_code(public.visit_requests) from public, anon, authenticated;
revoke execute on function public.visit_request_ttl() from public, anon, authenticated;

grant execute on function public.admin_decide_staff_request(uuid, boolean) to authenticated;
grant execute on function public.staff_decide_visit(uuid, boolean) to authenticated;
grant execute on function public.request_qr_visit(uuid, uuid, text, uuid, uuid, text, text) to service_role;

-- ===================== seed.sql =====================
-- Palm Bite drink menu.
-- Edit drinks, photos, descriptions and options any time in Admin > Drinks menu.

insert into public.drinks (name, category, accent_color, sort_order, is_reward_eligible, is_sample) values
  ('Palms Frappuccino',      'Drinks', '#8B6A4F', 10, true, false),
  ('Mint Tea',               'Drinks', '#8FBF8A', 20, true, false),
  ('Melis',                  'Drinks', '#C9A27E', 30, true, false),
  ('Crips Love',             'Drinks', '#D98C8C', 40, true, false),
  ('Matcha',                 'Drinks', '#9DB27C', 50, true, false),
  ('Espresso',               'Drinks', '#5A3E2B', 60, true, false),
  ('Caramel Velvet Latte',   'Drinks', '#C68B59', 70, true, false),
  ('Caramel Velvet Matcha',  'Drinks', '#A8B47A', 80, true, false),
  ('Our Latte',              'Drinks', '#D2B48C', 90, true, false),
  ('Hibiscus Juice',         'Juices', '#A63A50', 110, true, false),
  ('Pineapple Juice',        'Juices', '#E8C547', 120, true, false),
  ('Apple Juice',            'Juices', '#C9D86A', 130, true, false),
  ('Watermelon Juice',       'Juices', '#E86A6A', 140, true, false);
