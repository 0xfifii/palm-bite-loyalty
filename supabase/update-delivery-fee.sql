-- Palm Bite Loyalty UPDATE: 2,000 naira delivery fee on delivery orders, and who accepted each order.
-- Safe to run more than once. Paste into Supabase > SQL Editor and click Run, once.

-- Palm Bite Loyalty: delivery fee and who accepted each order.
-- Delivery orders add a flat delivery fee (2,000 naira by default, set in
-- Admin > Settings) to the bill. Each order records the team member who
-- accepted it. Safe to run more than once.

alter table public.app_settings
  add column if not exists delivery_fee_naira integer not null default 2000
    check (delivery_fee_naira between 0 and 100000);

alter table public.orders
  add column if not exists delivery_fee_naira integer not null default 0 check (delivery_fee_naira >= 0),
  add column if not exists accepted_by uuid references public.profiles (id) on delete set null,
  add column if not exists accepted_by_name text check (accepted_by_name is null or char_length(accepted_by_name) <= 80),
  add column if not exists accepted_at timestamptz;

create or replace function public.admin_update_delivery_fee(p_fee integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if p_fee is null or p_fee not between 0 and 100000 then
    return jsonb_build_object('code', 'INVALID_INPUT');
  end if;
  update public.app_settings set delivery_fee_naira = p_fee, updated_at = now(), updated_by = auth.uid() where id;
  perform public.write_audit(auth.uid(), 'settings.delivery_fee_updated', 'app_settings', 'global', jsonb_build_object('fee', p_fee));
  return jsonb_build_object('code', 'OK');
end;
$$;

create or replace function public.place_order(
  p_items jsonb, p_fulfilment text, p_note text, p_address text, p_contact text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
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
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHENTICATED');
  end if;
  if exists (select 1 from public.profiles where id = v_uid and status <> 'active') then
    return jsonb_build_object('code', 'ACCOUNT_SUSPENDED');
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
      return jsonb_build_object('code', 'CONTACT_REQUIRED');
    end if;
    select coalesce(delivery_fee_naira, 0) into v_fee from public.app_settings where id;
  else
    v_address := null;
  end if;

  select count(*) into v_recent from public.orders where customer_id = v_uid and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then
    return jsonb_build_object('code', 'RATE_LIMITED');
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

  insert into public.orders (reference, customer_id, items, total_naira, delivery_fee_naira, fulfilment, note, delivery_address, contact_phone)
  values (v_ref, v_uid, v_lines, v_total + coalesce(v_fee, 0), coalesce(v_fee, 0), p_fulfilment, nullif(left(btrim(coalesce(p_note, '')), 500), ''), v_address, v_contact)
  returning id into v_id;

  return jsonb_build_object('code', 'ORDER_PLACED', 'order_id', v_id, 'reference', v_ref, 'items', v_lines,
    'subtotal', v_total, 'delivery_fee', coalesce(v_fee, 0), 'total', v_total + coalesce(v_fee, 0));
end;
$$;

create or replace function public.set_order_status(p_order uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_staff boolean := public.is_staff();
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHENTICATED');
  end if;
  if p_status not in ('new', 'confirmed', 'preparing', 'ready', 'on_the_way', 'completed', 'cancelled') then
    return jsonb_build_object('code', 'INVALID_ORDER');
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or (not v_staff and v_order.customer_id <> v_uid) then
    return jsonb_build_object('code', 'ORDER_NOT_FOUND');
  end if;
  if not v_staff then
    if p_status <> 'cancelled' then
      return jsonb_build_object('code', 'FORBIDDEN');
    end if;
    if v_order.status <> 'new' then
      return jsonb_build_object('code', 'ORDER_LOCKED');
    end if;
  end if;
  if v_order.status in ('completed', 'cancelled') then
    return jsonb_build_object('code', 'ORDER_CLOSED');
  end if;
  if p_status = 'on_the_way' and v_order.fulfilment <> 'delivery' then
    return jsonb_build_object('code', 'INVALID_ORDER');
  end if;
  update public.orders
  set status = p_status, updated_by = v_uid, status_changed_at = now(),
      -- The first team member to move the order along is the one who accepted it.
      accepted_by = case when accepted_by is null and v_staff and p_status not in ('new', 'cancelled') then v_uid else accepted_by end,
      accepted_by_name = case when accepted_by is null and v_staff and p_status not in ('new', 'cancelled')
                              then (select full_name from public.profiles where id = v_uid) else accepted_by_name end,
      accepted_at = case when accepted_by is null and v_staff and p_status not in ('new', 'cancelled') then now() else accepted_at end
  where id = p_order;
  return jsonb_build_object('code', 'OK', 'status', p_status, 'customer_id', v_order.customer_id, 'reference', v_order.reference);
end;
$$;

revoke execute on function public.admin_update_delivery_fee(integer) from public, anon, authenticated;
grant execute on function public.admin_update_delivery_fee(integer) to authenticated;
revoke execute on function public.place_order(jsonb, text, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text, text, text) to authenticated;
revoke execute on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.set_order_status(uuid, text) to authenticated;

notify pgrst, 'reload schema';
