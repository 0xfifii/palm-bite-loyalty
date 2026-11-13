-- Palm Bite Loyalty: full menu with prices, merchandise, community clubs and
-- events, and orders sent to Palm Bite on WhatsApp.

-- ---------------------------------------------------------------------------
-- Menu items (the drinks table now holds every item: drinks, food, picks, merch)
-- ---------------------------------------------------------------------------
alter table public.drinks
  add column if not exists price_naira integer check (price_naira is null or price_naira between 0 and 10000000),
  add column if not exists item_type text not null default 'drink'
    check (item_type in ('drink', 'food', 'pick', 'merch')),
  add column if not exists art text not null default 'iced'
    check (art in ('iced', 'frappe', 'juice', 'hot', 'plate', 'salad', 'waffle', 'cake', 'bread',
                   'croissant', 'pizza', 'pie', 'wrap', 'sandwich', 'combo', 'tee', 'tote', 'cap'));

-- Only drinks can be chosen as the free reward drink.
create or replace function public.reward_only_drinks()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.item_type <> 'drink' then
    new.is_reward_eligible := false;
  end if;
  return new;
end;
$$;

drop trigger if exists drinks_reward_only_drinks on public.drinks;
create trigger drinks_reward_only_drinks
before insert or update on public.drinks
for each row execute function public.reward_only_drinks();

-- Upsert helper for the menu below (by name).
create or replace function public._menu_upsert(
  p_name text, p_category text, p_type text, p_art text, p_price integer,
  p_color text, p_sort integer, p_description text
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.drinks
  set category = p_category, item_type = p_type, art = p_art, price_naira = p_price,
      accent_color = p_color, sort_order = p_sort,
      description = case when description = '' or description like 'Placeholder%' then p_description else description end,
      is_sample = false,
      is_reward_eligible = case when p_type = 'drink' then is_reward_eligible else false end
  where lower(name) = lower(p_name);
  if not found then
    insert into public.drinks (name, category, item_type, art, price_naira, accent_color, sort_order, description,
                               is_reward_eligible, is_sample)
    values (p_name, p_category, p_type, p_art, p_price, p_color, p_sort, p_description, p_type = 'drink', false);
  end if;
end;
$$;

-- Remove sample items if any are left from the first setup.
delete from public.drinks d
where d.is_sample and not exists (select 1 from public.redemptions r where r.drink_id = d.id);

-- Our Picks
select public._menu_upsert('Palms Frappuccino + Plantain Medley', 'Our Picks', 'pick', 'combo', 37000, '#8B6A4F', 1, 'Our signature frappuccino with a plate of Plantain Medley.');
select public._menu_upsert('Chicken Salad + Melis', 'Our Picks', 'pick', 'combo', 27000, '#E39AA6', 2, 'Fresh Chicken Salad paired with a layered Melis.');
select public._menu_upsert('Matcha + Potato Waffles', 'Our Picks', 'pick', 'combo', 24000, '#9DB27C', 3, 'Iced Matcha with a tall stack of Potato Waffles.');
-- Gems (signature drinks)
select public._menu_upsert('Mint Tea', 'Gems', 'drink', 'iced', 7000, '#7FC6C2', 10, 'Iced coffee poured over a cool mint-blue layer.');
select public._menu_upsert('Palms Frappuccino', 'Gems', 'drink', 'frappe', 17000, '#8B6A4F', 11, 'Blended iced coffee and milk with a light Baileys note, whipped cream and chocolate drizzle.');
select public._menu_upsert('Crips Love', 'Gems', 'drink', 'iced', 7000, '#C2456A', 12, 'Hibiscus and caramel milk over ice.');
select public._menu_upsert('Melis', 'Gems', 'drink', 'frappe', 10000, '#E39AA6', 13, 'Layered pink and coffee with syrup and whipped cream.');
-- Slab (signature food)
select public._menu_upsert('Plantain Medley', 'Slab', 'food', 'plate', 20000, '#E8A53A', 20, 'Fried plantain tossed with peppers and onions.');
select public._menu_upsert('Chicken Salad', 'Slab', 'food', 'salad', 17000, '#7DAA5A', 21, 'Crisp greens topped with sliced grilled chicken.');
select public._menu_upsert('Potato Waffles', 'Slab', 'food', 'waffle', 18000, '#D9A45B', 22, 'A tall, golden stack of potato waffles.');
select public._menu_upsert('Sweet Tooth', 'Slab', 'food', 'cake', 14000, '#5A3428', 23, 'Chocolate dessert slice with whipped cream and raspberries.');
-- Pastries
select public._menu_upsert('Zebra Bread', 'Pastries', 'food', 'bread', 5000, '#8A5A3C', 30, 'Swirled chocolate and vanilla loaf.');
select public._menu_upsert('Pizza', 'Pastries', 'food', 'pizza', 12000, '#D9533A', 31, 'Cheesy, freshly baked pizza.');
select public._menu_upsert('Sandwich', 'Pastries', 'food', 'sandwich', 6000, '#C99A5B', 32, 'Filled and toasted to order.');
select public._menu_upsert('Croissant', 'Pastries', 'food', 'croissant', 8000, '#D9A45B', 33, 'Buttery, flaky and golden.');
select public._menu_upsert('Meat Pie', 'Pastries', 'food', 'pie', 5000, '#C98B4A', 34, 'Golden pastry with a savoury meat filling.');
select public._menu_upsert('Shawarma', 'Pastries', 'food', 'wrap', 15000, '#D9A45B', 35, 'Warm wrap packed with grilled filling.');
-- Fresh juice and iced drinks
select public._menu_upsert('Apple Juice', 'Fresh', 'drink', 'juice', 13000, '#C9D86A', 40, 'Freshly pressed apple.');
select public._menu_upsert('Pineapple Juice', 'Fresh', 'drink', 'juice', 7000, '#E8C547', 41, 'Freshly pressed pineapple.');
select public._menu_upsert('Watermelon Juice', 'Fresh', 'drink', 'juice', 10000, '#E86A6A', 42, 'Freshly pressed watermelon.');
select public._menu_upsert('Hibiscus Juice', 'Fresh', 'drink', 'juice', 8000, '#A63A50', 43, 'Chilled hibiscus, our Palm way.');
select public._menu_upsert('Matcha', 'Fresh', 'drink', 'iced', 6000, '#9DB27C', 44, 'Smooth iced matcha.');
select public._menu_upsert('Caramel Velvet Matcha', 'Fresh', 'drink', 'iced', 7000, '#A8B47A', 45, 'Layered green matcha and cream over ice.');
select public._menu_upsert('Caramel Velvet Latte', 'Fresh', 'drink', 'iced', 7000, '#C68B59', 46, 'Iced latte finished with caramel drizzle.');
-- Palms Coffee
select public._menu_upsert('Our Latte', 'Palms Coffee', 'drink', 'hot', 8000, '#D2B48C', 50, 'Our house latte.');
select public._menu_upsert('Espresso', 'Palms Coffee', 'drink', 'hot', 5000, '#5A3E2B', 51, 'A short, strong shot.');
select public._menu_upsert('Spring Ice Coffee', 'Palms Coffee', 'drink', 'iced', 7000, '#7A5A40', 52, 'Cold coffee over ice.');
-- Merch 1.0 (in store at Palm View)
select public._menu_upsert('Palm Way Our Way Tee', 'Merch', 'merch', 'tee', 50000, '#F6F1E7', 60, 'White tee with the bitten P on the front and two friends on the back.');
select public._menu_upsert('Palm State of Mind Tee', 'Merch', 'merch', 'tee', 50000, '#1D2119', 61, 'Black tee with the bitten P on the front and an iced drink on the back.');
select public._menu_upsert('Palm Tote', 'Merch', 'merch', 'tote', 23000, '#1D2119', 62, 'Black tote with a cream bitten P and palm fronds along the bottom.');
select public._menu_upsert('Palm Community Cap', 'Merch', 'merch', 'cap', 15000, '#1D2119', 63, 'Black cap with a cream bitten P.');

drop function public._menu_upsert(text, text, text, text, integer, text, integer, text);

-- ---------------------------------------------------------------------------
-- Business settings used by ordering and the Visit us card
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column if not exists order_link text not null default 'https://wa.me/message/DYZNLHGJWIAIC1'
    check (order_link ~ '^https://'),
  add column if not exists whatsapp_number text
    check (whatsapp_number is null or whatsapp_number ~ '^[1-9][0-9]{7,14}$'),
  add column if not exists store_address text not null default 'Palm View, along UBA Gate',
  add column if not exists payment_note text;

create or replace function public.admin_update_business(
  p_order_link text, p_whatsapp_number text, p_store_address text, p_payment_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_number text := nullif(regexp_replace(coalesce(p_whatsapp_number, ''), '[^0-9]', '', 'g'), '');
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  if p_order_link is null or p_order_link !~ '^https://' then
    return jsonb_build_object('code', 'INVALID_LINK');
  end if;
  if v_number is not null and v_number !~ '^[1-9][0-9]{7,14}$' then
    return jsonb_build_object('code', 'INVALID_PHONE');
  end if;
  update public.app_settings
  set order_link = btrim(p_order_link),
      whatsapp_number = v_number,
      store_address = left(coalesce(nullif(btrim(p_store_address), ''), 'Palm View, along UBA Gate'), 200),
      payment_note = nullif(left(btrim(coalesce(p_payment_note, '')), 500), ''),
      updated_at = now(), updated_by = auth.uid()
  where id;
  perform public.write_audit(auth.uid(), 'settings.business_updated', 'app_settings', 'global', '{}'::jsonb);
  return jsonb_build_object('code', 'OK');
end;
$$;

-- Public read of the business details (not the timezone internals).
grant select on public.app_settings to anon;
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Community: Fitness Club, Book Club and events
-- ---------------------------------------------------------------------------
create table if not exists public.community_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('club', 'event')),
  title text not null check (char_length(btrim(title)) between 2 and 80),
  tagline text not null default '' check (char_length(tagline) <= 120),
  description text not null default '' check (char_length(description) <= 1000),
  schedule text not null default '' check (char_length(schedule) <= 160),
  location text not null default '' check (char_length(location) <= 160),
  join_link text check (join_link is null or join_link ~ '^https://'),
  starts_at timestamptz,
  icon text not null default 'spark' check (icon in ('fitness', 'book', 'spark')),
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists community_items_touch on public.community_items;
create trigger community_items_touch before update on public.community_items
for each row execute function public.touch_updated_at();

alter table public.community_items enable row level security;
revoke all on public.community_items from anon, authenticated;
grant select on public.community_items to anon, authenticated;
grant insert, update, delete on public.community_items to authenticated;

drop policy if exists community_read on public.community_items;
create policy community_read on public.community_items
  for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists community_admin_insert on public.community_items;
create policy community_admin_insert on public.community_items
  for insert to authenticated with check (public.is_admin());
drop policy if exists community_admin_update on public.community_items;
create policy community_admin_update on public.community_items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists community_admin_delete on public.community_items;
create policy community_admin_delete on public.community_items
  for delete to authenticated using (public.is_admin());

insert into public.community_items (kind, title, tagline, description, schedule, location, icon, sort_order, starts_at)
select * from (values
  ('club', 'Palm Fitness Club', 'Move together, refuel together.',
   'Our community fitness club for Palm Frens who like to move. Ask us at the counter about the next session.',
   '', 'Palm View, along UBA Gate', 'fitness', 1, null::timestamptz),
  ('club', 'Palm Book Club', 'Good books, good company, good coffee.',
   'Our community book club for Palm Frens who love a good read. Ask us at the counter about the current book.',
   '', 'Palm View, along UBA Gate', 'book', 2, null::timestamptz),
  ('event', 'Taste Palm Way', 'The Palm Bite opening.',
   'Come and taste the Palm way: signature Gems, Slab and fresh juice.',
   'Monday, 16 November, 12pm', 'Palm View, along UBA Gate', 'spark', 3, timestamptz '2026-11-16 12:00:00+01')
) as v(kind, title, tagline, description, schedule, location, icon, sort_order, starts_at)
where not exists (select 1 from public.community_items);

-- ---------------------------------------------------------------------------
-- Orders (sent to Palm Bite on WhatsApp, tracked here for staff)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^OR-[0-9A-Z]{5}$'),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 40),
  total_naira integer not null check (total_naira >= 0),
  fulfilment text not null check (fulfilment in ('pickup', 'dine_in', 'delivery')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'new' check (status in ('new', 'confirmed', 'ready', 'completed', 'cancelled')),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders (status, created_at desc);
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select to authenticated using (customer_id = auth.uid() or public.is_staff());

-- Prices always come from the menu, never from the phone.
create or replace function public.place_order(p_items jsonb, p_fulfilment text, p_note text)
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

  insert into public.orders (reference, customer_id, items, total_naira, fulfilment, note)
  values (v_ref, v_uid, v_lines, v_total, p_fulfilment, nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  returning id into v_id;

  return jsonb_build_object('code', 'ORDER_PLACED', 'order_id', v_id, 'reference', v_ref, 'items', v_lines, 'total', v_total);
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
  if p_status not in ('new', 'confirmed', 'ready', 'completed', 'cancelled') then
    return jsonb_build_object('code', 'INVALID_ORDER');
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or (not v_staff and v_order.customer_id <> v_uid) then
    return jsonb_build_object('code', 'ORDER_NOT_FOUND');
  end if;
  -- Customers may only cancel their own new orders.
  if not v_staff and not (p_status = 'cancelled' and v_order.status = 'new') then
    return jsonb_build_object('code', 'FORBIDDEN');
  end if;
  update public.orders set status = p_status, updated_by = v_uid where id = p_order;
  return jsonb_build_object('code', 'OK', 'status', p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.reward_only_drinks() from public, anon, authenticated;
revoke execute on function public.admin_update_business(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.place_order(jsonb, text, text) from public, anon, authenticated;
revoke execute on function public.set_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_update_business(text, text, text, text) to authenticated;
grant execute on function public.place_order(jsonb, text, text) to authenticated;
grant execute on function public.set_order_status(uuid, text) to authenticated;
