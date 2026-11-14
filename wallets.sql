create table public.wallets (
  id uuid primary key,
  household_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 80),
  kind text not null check (kind in ('cash', 'bank', 'ewallet', 'other')),
  created_at timestamptz not null default now(),
  unique (household_id, name)
);
alter table public.wallets enable row level security;
grant select, insert on public.wallets to authenticated;
create policy "members read wallets" on public.wallets for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members create wallets" on public.wallets for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

-- Keep legacy wallet labels available without altering existing transactions.
insert into public.wallets (id, household_id, name, kind)
select gen_random_uuid(), household_id, wallet, 'other'
from public.transactions group by household_id, wallet;

