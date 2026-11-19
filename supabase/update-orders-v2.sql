-- Palm Bite Loyalty UPDATE: ordering with bank transfer, receipts, delivery details, go ahead,
-- order status flow, phone notifications, Chicken Pie and Palm Bread. Safe to run more than once.
-- Paste into Supabase > SQL Editor and click Run, once.

-- Palm Bite Loyalty: orders, version 2.
-- In-app ordering with bank transfer details, payment receipts, delivery
-- address and contact number, a "go ahead" nudge for staff, a fuller status
-- flow (confirmed, preparing, ready or on its way, completed), and phone
-- notifications (web push subscriptions). Also adds Chicken Pie and Palm Bread.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Bank details shown at checkout
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column if not exists bank_name text not null default 'Providus Bank'
    check (char_length(bank_name) between 2 and 60),
  add column if not exists bank_account_name text not null default 'PalmBite'
    check (char_length(bank_account_name) between 2 and 80),
  add column if not exists bank_account_number text not null default '1311482257'
    check (bank_account_number ~ '^[0-9]{10}$');

create or replace function public.admin_update_bank(p_bank_name text, p_account_name text, p_account_number text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_number text := regexp_replace(coalesce(p_account_number, ''), '[^0-9]', '', 'g');
begin
  if not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if char_length(btrim(coalesce(p_bank_name, ''))) < 2 or char_length(btrim(coalesce(p_account_name, ''))) < 2 or v_number !~ '^[0-9]{10}$' then
    return jsonb_build_object('code', 'INVALID_INPUT');
  end if;
  update public.app_settings
  set bank_name = left(btrim(p_bank_name), 60),
      bank_account_name = left(btrim(p_account_name), 80),
      bank_account_number = v_number,
      updated_at = now(), updated_by = auth.uid()
  where id;
  perform public.write_audit(auth.uid(), 'settings.bank_updated', 'app_settings', 'global', '{}'::jsonb);
  return jsonb_build_object('code', 'OK');
end;
$$;

-- ---------------------------------------------------------------------------
-- Orders: delivery details, payment, go-ahead, more statuses
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists delivery_address text check (delivery_address is null or char_length(delivery_address) between 5 and 300),
  add column if not exists contact_phone text check (contact_phone is null or contact_phone ~ '^\+?[0-9]{7,15}$'),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'receipt_sent', 'paid')),
  add column if not exists receipt_path text check (receipt_path is null or char_length(receipt_path) <= 200),
  add column if not exists receipt_uploaded_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists go_ahead_at timestamptz,
  add column if not exists status_changed_at timestamptz not null default now();

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'confirmed', 'preparing', 'ready', 'on_the_way', 'completed', 'cancelled'));

create index if not exists orders_open_idx on public.orders (created_at)
  where status in ('new', 'confirmed', 'preparing', 'ready', 'on_the_way');

-- Prices always come from the menu. Delivery needs an address and a number.
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

  insert into public.orders (reference, customer_id, items, total_naira, fulfilment, note, delivery_address, contact_phone)
  values (v_ref, v_uid, v_lines, v_total, p_fulfilment, nullif(left(btrim(coalesce(p_note, '')), 500), ''), v_address, v_contact)
  returning id into v_id;

  return jsonb_build_object('code', 'ORDER_PLACED', 'order_id', v_id, 'reference', v_ref, 'items', v_lines, 'total', v_total);
end;
$$;

-- The first version keeps working for pick up and dine in.
create or replace function public.place_order(p_items jsonb, p_fulfilment text, p_note text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.place_order(p_items, p_fulfilment, p_note, case when p_fulfilment = 'delivery' then p_note end, null)
$$;

-- Status flow. Staff move orders along; a Palm Fren can only cancel an order
-- that Palm Bite has not confirmed yet.
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
  set status = p_status, updated_by = v_uid, status_changed_at = now()
  where id = p_order;
  return jsonb_build_object('code', 'OK', 'status', p_status, 'customer_id', v_order.customer_id, 'reference', v_order.reference);
end;
$$;

-- A Palm Fren tells Palm Bite to go ahead with their order.
create or replace function public.order_go_ahead(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order and customer_id = auth.uid() for update;
  if not found then
    return jsonb_build_object('code', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status in ('completed', 'cancelled') then
    return jsonb_build_object('code', 'ORDER_CLOSED');
  end if;
  if v_order.go_ahead_at is not null and v_order.go_ahead_at > now() - interval '2 minutes' then
    return jsonb_build_object('code', 'RATE_LIMITED');
  end if;
  update public.orders set go_ahead_at = now() where id = p_order;
  return jsonb_build_object('code', 'OK', 'reference', v_order.reference);
end;
$$;

-- A Palm Fren attaches a transfer receipt (uploaded to their own folder).
create or replace function public.submit_order_receipt(p_order uuid, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHENTICATED');
  end if;
  if p_path is null or p_path !~ ('^' || v_uid::text || '/[A-Za-z0-9._-]{1,120}$') then
    return jsonb_build_object('code', 'INVALID_INPUT');
  end if;
  select * into v_order from public.orders where id = p_order and customer_id = v_uid for update;
  if not found then
    return jsonb_build_object('code', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status = 'cancelled' or v_order.payment_status = 'paid' then
    return jsonb_build_object('code', 'ORDER_CLOSED');
  end if;
  update public.orders
  set receipt_path = p_path, receipt_uploaded_at = now(), payment_status = 'receipt_sent'
  where id = p_order;
  return jsonb_build_object('code', 'OK', 'reference', v_order.reference);
end;
$$;

-- Staff confirm that the money arrived (or undo it).
create or replace function public.set_order_payment(p_order uuid, p_paid boolean)
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
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    return jsonb_build_object('code', 'ORDER_NOT_FOUND');
  end if;
  update public.orders
  set payment_status = case when p_paid then 'paid' when receipt_path is not null then 'receipt_sent' else 'unpaid' end,
      paid_at = case when p_paid then now() else null end,
      updated_by = auth.uid()
  where id = p_order;
  return jsonb_build_object('code', 'OK', 'customer_id', v_order.customer_id, 'reference', v_order.reference);
end;
$$;

-- ---------------------------------------------------------------------------
-- Receipt files: private. Palm Frens upload into their own folder; staff can read.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-receipts', 'order-receipts', false, 6291456,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists order_receipts_owner_insert on storage.objects;
create policy order_receipts_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'order-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists order_receipts_read on storage.objects;
create policy order_receipts_read on storage.objects
  for select to authenticated
  using (bucket_id = 'order-receipts' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff())));

-- ---------------------------------------------------------------------------
-- Phone notifications (web push). One row per device that said yes.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('code', 'UNAUTHENTICATED');
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or coalesce(char_length(p_p256dh), 0) not between 10 and 200 or coalesce(char_length(p_auth), 0) not between 8 and 100 then
    return jsonb_build_object('code', 'INVALID_INPUT');
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
  -- Keep at most 5 devices per person.
  delete from public.push_subscriptions
  where user_id = auth.uid()
    and id not in (select id from public.push_subscriptions where user_id = auth.uid() order by created_at desc limit 5);
  return jsonb_build_object('code', 'OK');
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with d as (delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid() returning 1)
  select jsonb_build_object('code', 'OK')
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_update_bank(text, text, text) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.set_order_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.order_go_ahead(uuid) from public, anon, authenticated;
revoke execute on function public.submit_order_receipt(uuid, text) from public, anon, authenticated;
revoke execute on function public.set_order_payment(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon, authenticated;
revoke execute on function public.remove_push_subscription(text) from public, anon, authenticated;
grant execute on function public.admin_update_bank(text, text, text) to authenticated;
grant execute on function public.place_order(jsonb, text, text, text, text) to authenticated;
grant execute on function public.place_order(jsonb, text, text) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;
grant execute on function public.order_go_ahead(uuid) to authenticated;
grant execute on function public.submit_order_receipt(uuid, text) to authenticated;
grant execute on function public.set_order_payment(uuid, boolean) to authenticated;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- ---------------------------------------------------------------------------
-- New pastries
-- ---------------------------------------------------------------------------
insert into public.drinks (name, category, item_type, art, price_naira, accent_color, sort_order, description, is_reward_eligible, is_sample)
select v.name, 'Pastries', 'food', v.art, v.price, v.color, v.sort, v.descr, false, false
from (values
  ('Chicken Pie', 'pie', 5000, '#D9A45B', 36, 'Golden, crimped pastry filled with seasoned chicken.'),
  ('Palm Bread', 'bread', 3000, '#E3B17A', 37, 'Soft, fluffy milk bread, baked fresh.')
) as v(name, art, price, color, sort, descr)
where not exists (select 1 from public.drinks d where lower(d.name) = lower(v.name));

update public.drinks set price_naira = 5000, is_active = true where lower(name) = 'chicken pie';
update public.drinks set price_naira = 3000, is_active = true where lower(name) = 'palm bread';

notify pgrst, 'reload schema';
