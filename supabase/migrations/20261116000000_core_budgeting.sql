-- BudgetEase: core budgeting tables
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).
-- Safe to re-run: every statement is idempotent.

-- ============================================================
-- 1. EXPENSES: transaction date, recurring end, receipt link
-- ============================================================
alter table public.expenses add column if not exists occurred_on date;
update public.expenses set occurred_on = created_at::date where occurred_on is null;
alter table public.expenses alter column occurred_on set default current_date;
alter table public.expenses alter column occurred_on set not null;

alter table public.expenses add column if not exists recurring_end date;
alter table public.expenses add column if not exists receipt_path text;

alter table public.expenses enable row level security;
drop policy if exists "expenses_owner_all" on public.expenses;
create policy "expenses_owner_all" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists expenses_user_date_idx on public.expenses (user_id, occurred_on desc);

-- ============================================================
-- 2. CATEGORIES (expense + income), with optional monthly budget
-- ============================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind        text not null check (kind in ('expense', 'income')),
  name        text not null check (char_length(name) between 1 and 40),
  icon        text not null default 'circle',
  budget      numeric(14, 2) check (budget is null or budget >= 0),
  sort_order  int not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, kind, name)
);

alter table public.categories enable row level security;
drop policy if exists "categories_owner_all" on public.categories;
create policy "categories_owner_all" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 3. INCOME
-- ============================================================
create table if not exists public.income (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source        text not null check (char_length(source) between 1 and 120),
  amount        numeric(14, 2) not null check (amount >= 0),
  category      text not null default 'Salary',
  occurred_on   date not null default current_date,
  is_recurring  boolean not null default false,
  recurring_end date,
  created_at    timestamptz not null default now()
);

alter table public.income enable row level security;
drop policy if exists "income_owner_all" on public.income;
create policy "income_owner_all" on public.income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists income_user_date_idx on public.income (user_id, occurred_on desc);

-- ============================================================
-- 4. GOALS + CONTRIBUTIONS
-- ============================================================
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null check (char_length(name) between 1 and 80),
  target      numeric(14, 2) not null check (target > 0),
  target_date date,
  created_at  timestamptz not null default now()
);

alter table public.goals enable row level security;
drop policy if exists "goals_owner_all" on public.goals;
create policy "goals_owner_all" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.goal_contributions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  goal_id     uuid not null references public.goals(id) on delete cascade,
  amount      numeric(14, 2) not null check (amount <> 0), -- negative = withdrawal
  occurred_on date not null default current_date,
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.goal_contributions enable row level security;
drop policy if exists "goal_contributions_owner_all" on public.goal_contributions;
create policy "goal_contributions_owner_all" on public.goal_contributions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists goal_contributions_goal_idx on public.goal_contributions (goal_id);

-- ============================================================
-- 5. BASE CURRENCY CONVERSION (atomic, caller's rows only)
-- ============================================================
create or replace function public.convert_user_amounts(rate numeric)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if rate is null or rate <= 0 then
    raise exception 'Rate must be positive';
  end if;
  update public.expenses           set amount = round(amount * rate, 2) where user_id = auth.uid();
  update public.income             set amount = round(amount * rate, 2) where user_id = auth.uid();
  update public.categories         set budget = round(budget * rate, 2) where user_id = auth.uid() and budget is not null;
  update public.goals              set target = round(target * rate, 2) where user_id = auth.uid();
  update public.goal_contributions set amount = round(amount * rate, 2) where user_id = auth.uid();
end;
$$;

grant execute on function public.convert_user_amounts(numeric) to authenticated;

-- ============================================================
-- 6. REALTIME (cross-device sync)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['expenses', 'income', 'categories', 'goals', 'goal_contributions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 7. PRIVATE RECEIPTS BUCKET
--    Files live at receipts/<user_id>/<file>. Only the owner can read them,
--    via short-lived signed URLs.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do update set public = false;

drop policy if exists "receipts_owner_select" on storage.objects;
create policy "receipts_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_owner_insert" on storage.objects;
create policy "receipts_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts_owner_delete" on storage.objects;
create policy "receipts_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
