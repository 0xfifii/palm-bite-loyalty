-- Palm Bite Loyalty: performance for large numbers of Palm Frens.
-- Row Level Security policies now check "who is asking" once per request
-- (select ...) instead of once per row, and a few lookups get indexes.
-- Access rules are unchanged.

-- profiles
drop policy if exists profiles_read_own_or_staff on public.profiles;
create policy profiles_read_own_or_staff on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and status = 'active')
  with check (id = (select auth.uid()));

-- loyalty data
drop policy if exists loyalty_accounts_read on public.loyalty_accounts;
create policy loyalty_accounts_read on public.loyalty_accounts
  for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists visits_read on public.visits;
create policy visits_read on public.visits
  for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists loyalty_transactions_read on public.loyalty_transactions;
create policy loyalty_transactions_read on public.loyalty_transactions
  for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards
  for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists redemptions_read on public.redemptions;
create policy redemptions_read on public.redemptions
  for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists visit_requests_read on public.visit_requests;
create policy visit_requests_read on public.visit_requests
  for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_staff()));
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders
  for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_staff()));

-- menu
drop policy if exists drinks_read on public.drinks;
create policy drinks_read on public.drinks
  for select to anon, authenticated using (is_active or (select public.is_admin()));
drop policy if exists drinks_admin_insert on public.drinks;
create policy drinks_admin_insert on public.drinks
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists drinks_admin_update on public.drinks;
create policy drinks_admin_update on public.drinks
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists drinks_admin_delete on public.drinks;
create policy drinks_admin_delete on public.drinks
  for delete to authenticated using ((select public.is_admin()));

-- community
drop policy if exists community_read on public.community_items;
create policy community_read on public.community_items
  for select to anon, authenticated using (is_active or (select public.is_admin()));
drop policy if exists community_admin_insert on public.community_items;
create policy community_admin_insert on public.community_items
  for insert to authenticated with check ((select public.is_admin()));
drop policy if exists community_admin_update on public.community_items;
create policy community_admin_update on public.community_items
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists community_admin_delete on public.community_items;
create policy community_admin_delete on public.community_items
  for delete to authenticated using ((select public.is_admin()));

-- staff and admin views
drop policy if exists qr_sessions_staff_read on public.qr_sessions;
create policy qr_sessions_staff_read on public.qr_sessions
  for select to authenticated using ((select public.is_staff()));
drop policy if exists scan_attempts_admin_read on public.scan_attempts;
create policy scan_attempts_admin_read on public.scan_attempts
  for select to authenticated using ((select public.is_admin()));
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using ((select public.is_admin()));

-- indexes for lookups that grow with the number of Palm Frens
create index if not exists redemptions_customer_idx on public.redemptions (customer_id, requested_at desc);
create index if not exists scan_attempts_customer_idx on public.scan_attempts (customer_id, created_at desc);
create index if not exists visit_requests_customer_idx on public.visit_requests (customer_id, created_at desc);
create index if not exists loyalty_transactions_created_idx on public.loyalty_transactions (created_at desc);
create index if not exists redemptions_completed_idx on public.redemptions (completed_at desc) where status = 'completed';
create index if not exists orders_created_idx on public.orders (created_at desc);
