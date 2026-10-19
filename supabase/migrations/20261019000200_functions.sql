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
