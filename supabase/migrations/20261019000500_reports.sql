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
