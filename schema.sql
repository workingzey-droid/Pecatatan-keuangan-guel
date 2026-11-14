-- Anggota harus ditambahkan oleh administrator setelah akun dibuat.
create table public.household_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null
);

create table public.transactions (
  id uuid primary key,
  household_id uuid not null,
  kind text not null check (kind in ('income', 'expense', 'saving')),
  amount bigint not null check (amount > 0 and amount <= 9000000000000),
  transaction_date date not null,
  category text not null check (length(trim(category)) between 1 and 80),
  wallet text not null check (length(trim(wallet)) between 1 and 80),
  goal_id uuid,
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key,
  household_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  target bigint not null check (target > 0 and target <= 9000000000000),
  created_at timestamptz not null default now(),
  unique (household_id, id)
);

alter table public.transactions add constraint transactions_goal_fk
  foreign key (household_id, goal_id) references public.goals (household_id, id)
  on delete restrict;
alter table public.transactions add constraint saving_goal_required
  check ((kind = 'saving') = (goal_id is not null));

alter table public.household_members enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.transactions, public.goals to authenticated;
create policy "members read own membership" on public.household_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy "members share transactions" on public.transactions
  for all to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members share goals" on public.goals
  for all to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())))
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

