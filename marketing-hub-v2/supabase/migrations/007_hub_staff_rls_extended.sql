-- Extend hub staff RLS to theme + hub-local tables (after 004_hub_local_tables / 005).

create or replace function public.is_hub_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_archived, false) = false
      and p.role in ('admin', 'member')
  );
$$;

revoke all on function public.is_hub_staff() from public;
grant execute on function public.is_hub_staff() to authenticated;

drop policy if exists "staff_all_themes" on public.quarterly_themes;
drop policy if exists "staff_all_theme_mains" on public.theme_main_content;
drop policy if exists "staff_all_theme_offshoots" on public.theme_offshoots;
drop policy if exists "staff_all_award_entries" on public.award_entries;
drop policy if exists "staff_all_hub_tasks" on public.hub_tasks;
drop policy if exists "staff_all_merch_orders" on public.merch_orders;
drop policy if exists "staff_all_staff_requests" on public.staff_requests;
drop policy if exists "staff_all_report_links" on public.report_links;
drop policy if exists "hub_staff_themes" on public.quarterly_themes;
drop policy if exists "hub_staff_theme_mains" on public.theme_main_content;
drop policy if exists "hub_staff_theme_offshoots" on public.theme_offshoots;

create policy "hub_staff_themes" on public.quarterly_themes
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());

create policy "hub_staff_theme_mains" on public.theme_main_content
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());

create policy "hub_staff_theme_offshoots" on public.theme_offshoots
  for all to authenticated
  using (public.is_hub_staff())
  with check (public.is_hub_staff());

do $$
begin
  if to_regclass('public.award_entries') is not null then
    execute 'drop policy if exists "hub_staff_award_entries" on public.award_entries';
    execute 'create policy "hub_staff_award_entries" on public.award_entries for all to authenticated using (public.is_hub_staff()) with check (public.is_hub_staff())';
  end if;
  if to_regclass('public.hub_tasks') is not null then
    execute 'drop policy if exists "hub_staff_hub_tasks" on public.hub_tasks';
    execute 'create policy "hub_staff_hub_tasks" on public.hub_tasks for all to authenticated using (public.is_hub_staff()) with check (public.is_hub_staff())';
  end if;
  if to_regclass('public.merch_orders') is not null then
    execute 'drop policy if exists "hub_staff_merch_orders" on public.merch_orders';
    execute 'create policy "hub_staff_merch_orders" on public.merch_orders for all to authenticated using (public.is_hub_staff()) with check (public.is_hub_staff())';
  end if;
  if to_regclass('public.staff_requests') is not null then
    execute 'drop policy if exists "hub_staff_staff_requests" on public.staff_requests';
    execute 'create policy "hub_staff_staff_requests" on public.staff_requests for all to authenticated using (public.is_hub_staff()) with check (public.is_hub_staff())';
  end if;
  if to_regclass('public.report_links') is not null then
    execute 'drop policy if exists "hub_staff_report_links" on public.report_links';
    execute 'create policy "hub_staff_report_links" on public.report_links for all to authenticated using (public.is_hub_staff()) with check (public.is_hub_staff())';
  end if;
end $$;
