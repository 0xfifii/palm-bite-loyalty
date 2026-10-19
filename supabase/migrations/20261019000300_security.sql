-- Palm Bite Loyalty: Row Level Security, grants and function permissions.
-- Clients get read access to their own rows only. Every write to loyalty
-- data happens inside the security definer functions defined earlier.

-- ---------------------------------------------------------------------------
-- Start from zero privileges for API roles
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter table public.locations enable row level security;
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.qr_sessions enable row level security;
alter table public.visits enable row level security;
alter table public.rewards enable row level security;
alter table public.drinks enable row level security;
alter table public.redemptions enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.scan_attempts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- Policy helper functions must be executable by API roles.
-- anon needs these too: the drinks and storage policies call is_admin(),
-- which simply returns false when there is no signed-in user.
grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.points_per_reward() to anon, authenticated;
grant execute on function public.business_date_for(timestamptz, text) to authenticated;
grant execute on function public.business_today() to authenticated;
grant execute on function public.business_timezone() to authenticated;

-- ---------------------------------------------------------------------------
-- Locations and settings
-- ---------------------------------------------------------------------------
grant select on public.locations to anon, authenticated;
create policy locations_read on public.locations
  for select to anon, authenticated using (true);

grant select on public.app_settings to authenticated;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Profiles: customers read and edit their own name and phone only.
-- Role, status and email cannot be changed through the API.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy profiles_read_own_or_staff on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() and status = 'active')
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Loyalty data: read own (customers) or all (staff and admins). No writes.
-- ---------------------------------------------------------------------------
grant select on public.loyalty_accounts to authenticated;
create policy loyalty_accounts_read on public.loyalty_accounts
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.visits to authenticated;
create policy visits_read on public.visits
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.loyalty_transactions to authenticated;
create policy loyalty_transactions_read on public.loyalty_transactions
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.rewards to authenticated;
create policy rewards_read on public.rewards
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

grant select on public.redemptions to authenticated;
create policy redemptions_read on public.redemptions
  for select to authenticated
  using (customer_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Drinks: everyone reads active drinks; administrators manage the menu.
-- ---------------------------------------------------------------------------
grant select on public.drinks to anon, authenticated;
grant insert, update, delete on public.drinks to authenticated;

create policy drinks_read on public.drinks
  for select to anon, authenticated
  using (is_active or public.is_admin());

create policy drinks_admin_insert on public.drinks
  for insert to authenticated with check (public.is_admin());

create policy drinks_admin_update on public.drinks
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy drinks_admin_delete on public.drinks
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- QR sessions, scan attempts and audit logs
-- ---------------------------------------------------------------------------
grant select on public.qr_sessions to authenticated;
create policy qr_sessions_staff_read on public.qr_sessions
  for select to authenticated using (public.is_staff());

grant select on public.scan_attempts to authenticated;
create policy scan_attempts_admin_read on public.scan_attempts
  for select to authenticated using (public.is_admin());

grant select on public.audit_logs to authenticated;
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (public.is_admin());

-- rate_limits: no API access at all (RLS enabled, no policies, no grants).

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------
-- Authenticated users (each function checks the caller's role internally).
grant execute on function public.select_reward_drink(uuid, uuid, jsonb) to authenticated;
grant execute on function public.cancel_redemption(text, text) to authenticated;
grant execute on function public.lookup_redemption(text) to authenticated;
grant execute on function public.complete_redemption(text) to authenticated;
grant execute on function public.staff_check_in(uuid, text) to authenticated;
grant execute on function public.create_qr_session(uuid, text) to authenticated;
grant execute on function public.revoke_qr_sessions(uuid, text) to authenticated;
grant execute on function public.admin_adjust_points(uuid, integer, text) to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text) to authenticated;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
grant execute on function public.admin_cancel_reward(uuid, text) to authenticated;
grant execute on function public.admin_update_settings(text, integer) to authenticated;
grant execute on function public.admin_search_customers(text, integer, integer) to authenticated;
grant execute on function public.admin_overview() to authenticated;

-- Server only (service role). These trust the server's authentication and
-- token signature checks, so they must never be reachable by clients.
grant execute on function public.award_qr_visit(uuid, uuid, text, uuid, uuid, text, text) to service_role;
grant execute on function public.log_scan_attempt(uuid, uuid, text, text, text) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.registration_conflicts(text, text) to service_role;
grant execute on function public.promote_to_admin(text) to service_role;

-- Internal functions stay private (no grants):
-- _award_point, _issue_reward_if_complete, write_audit, account_snapshot,
-- generate_code, customizations_valid, handle_new_user.

-- Ensure functions created later are not executable by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
