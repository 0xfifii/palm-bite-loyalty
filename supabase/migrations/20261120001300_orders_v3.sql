-- Palm Bite Loyalty: orders, version 3.
-- * A Packaging step between Preparing and Ready.
-- * The team member who confirms an order takes charge of it; other staff see
--   who is in charge and only that person (or an admin) can move it along.
-- * Ready time estimates from 5 to 45 minutes, shown to the Palm Fren.
-- * Cancel reasons such as "Not available", shown to the Palm Fren.
-- * Staff can place orders for customers (with an account, or walk in).
-- Safe to run more than once.

alter table public.orders alter column customer_id drop not null;

alter table public.orders
  add column if not exists walk_in_name text check (walk_in_name is null or char_length(walk_in_name) between 1 and 80),
  add column if not exists placed_by uuid references public.profiles (id) on delete set null,
  add column if not exists eta_minutes integer check (eta_minutes is null or eta_minutes in (5, 10, 15, 20, 25, 30, 35, 40, 45)),
  add column if not exists eta_at timestamptz,
  add column if not exists cancel_reason text check (cancel_reason is null or char_length(cancel_reason) between 2 and 160);

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'confirmed', 'preparing', 'packaging', 'ready', 'on_the_way', 'completed', 'cancelled'));

alter table public.orders drop constraint if exists orders_who_check;
alter table public.orders add constraint orders_who_check check (customer_id is not null or walk_in_name is not null);

drop index if exists public.orders_open_idx;
create index if not exists orders_open_idx on public.orders (created_at)
  where status in ('new', 'confirmed', 'preparing', 'packaging', 'ready', 'on_the_way');
create index if not exists orders_accepted_by_idx on public.orders (accepted_by, status_changed_at desc);

-- Staff move orders along. Confirming takes charge; after that only the person
-- in charge or an admin can change the order. Customers can't change orders.
create or replace function public.staff_set_order_status(p_order uuid, p_status text, p_reason text, p_eta integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_admin boolean := public.is_admin();
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 160), '');
  v_take boolean;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHENTICATED');
  end if;
  if p_status not in ('confirmed', 'preparing', 'packaging', 'ready', 'on_the_way', 'completed', 'cancelled') then
    return jsonb_build_object('code', 'INVALID_ORDER');
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    return jsonb_build_object('code', 'ORDER_NOT_FOUND');
  end if;
  if not public.is_staff() then
    return jsonb_build_object('code', case when v_order.customer_id = v_uid then 'ORDER_LOCKED' else 'ORDER_NOT_FOUND' end);
  end if;
  if v_order.status in ('completed', 'cancelled') then
    return jsonb_build_object('code', 'ORDER_CLOSED');
  end if;
  if v_order.accepted_by is not null and v_order.accepted_by <> v_uid and not v_admin then
    return jsonb_build_object('code', 'NOT_IN_CHARGE', 'in_charge', v_order.accepted_by_name);
  end if;
  if p_status = 'on_the_way' and v_order.fulfilment <> 'delivery' then
    return jsonb_build_object('code', 'INVALID_ORDER');
  end if;
  if p_status = 'cancelled' and v_reason is null then
    return jsonb_build_object('code', 'REASON_REQUIRED');
  end if;
  if p_eta is not null and p_eta not in (5, 10, 15, 20, 25, 30, 35, 40, 45) then
    return jsonb_build_object('code', 'INVALID_ETA');
  end if;

  v_take := v_order.accepted_by is null and p_status <> 'cancelled';
  update public.orders
  set status = p_status,
      updated_by = v_uid,
      status_changed_at = now(),
      accepted_by = case when v_take then v_uid else accepted_by end,
      accepted_by_name = case when v_take then (select full_name from public.profiles where id = v_uid) else accepted_by_name end,
      accepted_at = case when v_take then now() else accepted_at end,
      eta_minutes = coalesce(p_eta, eta_minutes),
      eta_at = case when p_eta is not null then now() + make_interval(mins => p_eta) else eta_at end,
      cancel_reason = case when p_status = 'cancelled' then v_reason else cancel_reason end
  where id = p_order;
  return jsonb_build_object('code', 'OK', 'status', p_status, 'customer_id', v_order.customer_id, 'reference', v_order.reference);
end;
$$;

-- Earlier versions keep working (customers get ORDER_LOCKED; staff need a reason to cancel).
create or replace function public.set_order_status(p_order uuid, p_status text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.staff_set_order_status(p_order, p_status, case when p_status = 'cancelled' then 'Cancelled by Palm Bite' end, null)
$$;

-- The person in charge can update the ready time.
create or replace function public.set_order_eta(p_order uuid, p_eta integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  if not public.is_staff() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if p_eta is null or p_eta not in (5, 10, 15, 20, 25, 30, 35, 40, 45) then
    return jsonb_build_object('code', 'INVALID_ETA');
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    return jsonb_build_object('code', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status in ('completed', 'cancelled') then
    return jsonb_build_object('code', 'ORDER_CLOSED');
  end if;
  if v_order.accepted_by is not null and v_order.accepted_by <> auth.uid() and not public.is_admin() then
    return jsonb_build_object('code', 'NOT_IN_CHARGE', 'in_charge', v_order.accepted_by_name);
  end if;
  update public.orders set eta_minutes = p_eta, eta_at = now() + make_interval(mins => p_eta), updated_by = auth.uid() where id = p_order;
  return jsonb_build_object('code', 'OK', 'customer_id', v_order.customer_id, 'reference', v_order.reference);
end;
$$;

-- Staff place an order for a customer (account or walk in). The order starts
-- confirmed and the staff member is in charge of it.
create or replace function public.staff_place_order(
  p_customer uuid, p_walk_in_name text, p_items jsonb, p_fulfilment text, p_note text,
  p_address text, p_contact text, p_paid boolean, p_eta integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_walk text := nullif(left(btrim(coalesce(p_walk_in_name, '')), 80), '');
  v_item jsonb;
  v_drink public.drinks;
  v_qty integer;
  v_lines jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_ref text;
  v_id uuid;
  v_recent integer;
  v_address text := nullif(left(btrim(coalesce(p_address, '')), 300), '');
  v_contact text := nullif(regexp_replace(coalesce(p_contact, ''), '[^0-9+]', '', 'g'), '');
  v_fee integer := 0;
begin
  if v_uid is null or not public.is_staff() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if p_customer is null and v_walk is null then
    return jsonb_build_object('code', 'CUSTOMER_REQUIRED');
  end if;
  if p_customer is not null and not exists (select 1 from public.profiles where id = p_customer and status = 'active') then
    return jsonb_build_object('code', 'CUSTOMER_NOT_FOUND');
  end if;
  if p_eta is not null and p_eta not in (5, 10, 15, 20, 25, 30, 35, 40, 45) then
    return jsonb_build_object('code', 'INVALID_ETA');
  end if;
  if p_fulfilment not in ('pickup', 'dine_in', 'delivery') then
    return jsonb_build_object('code', 'INVALID_ORDER');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then
    return jsonb_build_object('code', 'EMPTY_ORDER');
  end if;
  if v_contact is not null and v_contact !~ '^\+?[0-9]{7,15}$' then
    return jsonb_build_object('code', 'INVALID_CONTACT');
  end if;
  if p_fulfilment = 'delivery' then
    if v_address is null or char_length(v_address) < 5 then
      return jsonb_build_object('code', 'ADDRESS_REQUIRED');
    end if;
    if v_contact is null then
      v_contact := (select regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g') from public.profiles where id = p_customer);
      v_contact := nullif(v_contact, '');
    end if;
    if v_contact is null then
      return jsonb_build_object('code', 'CONTACT_REQUIRED');
    end if;
    select coalesce(delivery_fee_naira, 0) into v_fee from public.app_settings where id;
  else
    v_address := null;
  end if;


  for v_item in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := (v_item ->> 'qty')::integer;
    exception when others then
      return jsonb_build_object('code', 'INVALID_ORDER');
    end;
    if v_qty is null or v_qty not between 1 and 50 then
      return jsonb_build_object('code', 'INVALID_ORDER');
    end if;
    select * into v_drink from public.drinks where id = (v_item ->> 'id')::uuid and is_active;
    if not found or v_drink.price_naira is null then
      return jsonb_build_object('code', 'ITEM_UNAVAILABLE', 'item_id', v_item ->> 'id');
    end if;
    v_lines := v_lines || jsonb_build_object(
      'id', v_drink.id, 'name', v_drink.name, 'qty', v_qty,
      'price', v_drink.price_naira, 'line_total', v_drink.price_naira * v_qty
    );
    v_total := v_total + v_drink.price_naira * v_qty;
  end loop;

  loop
    v_ref := 'OR-' || public.generate_code(5);
    exit when not exists (select 1 from public.orders where reference = v_ref);
  end loop;

  insert into public.orders (
    reference, customer_id, walk_in_name, placed_by, items, total_naira, delivery_fee_naira, fulfilment, note, delivery_address, contact_phone,
    status, accepted_by, accepted_by_name, accepted_at, eta_minutes, eta_at, payment_status, paid_at, updated_by
  )
  values (v_ref, p_customer, case when p_customer is null then v_walk end, v_uid, v_lines, v_total + coalesce(v_fee, 0), coalesce(v_fee, 0), p_fulfilment, nullif(left(btrim(coalesce(p_note, '')), 500), ''), v_address, v_contact,
    'confirmed', v_uid, (select full_name from public.profiles where id = v_uid), now(),
    p_eta, case when p_eta is not null then now() + make_interval(mins => p_eta) end,
    case when p_paid then 'paid' else 'unpaid' end, case when p_paid then now() end, v_uid)
  returning id into v_id;

  return jsonb_build_object('code', 'ORDER_PLACED', 'order_id', v_id, 'reference', v_ref, 'items', v_lines,
    'subtotal', v_total, 'delivery_fee', coalesce(v_fee, 0), 'total', v_total + coalesce(v_fee, 0));
end;
$$;

revoke execute on function public.staff_set_order_status(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function public.set_order_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.set_order_eta(uuid, integer) from public, anon, authenticated;
revoke execute on function public.staff_place_order(uuid, text, jsonb, text, text, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.staff_set_order_status(uuid, text, text, integer) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;
grant execute on function public.set_order_eta(uuid, integer) to authenticated;
grant execute on function public.staff_place_order(uuid, text, jsonb, text, text, text, text, boolean, integer) to authenticated;
