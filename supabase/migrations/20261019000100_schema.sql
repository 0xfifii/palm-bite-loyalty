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
