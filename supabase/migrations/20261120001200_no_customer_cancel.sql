-- Palm Bite Loyalty: once a Palm Fren sends an order, it can't be cancelled
-- from the app. Only the Palm Bite team can cancel. Safe to run more than once.

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
  -- Once sent, only the Palm Bite team can change or cancel an order.
  if not v_staff then
    return jsonb_build_object('code', case when p_status = 'cancelled' then 'ORDER_LOCKED' else 'FORBIDDEN' end);
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

revoke execute on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.set_order_status(uuid, text) to authenticated;
