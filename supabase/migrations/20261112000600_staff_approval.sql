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
