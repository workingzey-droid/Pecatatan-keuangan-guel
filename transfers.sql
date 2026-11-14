create table public.wallet_transfers (
  id uuid primary key,
  household_id uuid not null,
  source_wallet text not null,
  destination_wallet text not null,
  amount bigint not null check (amount > 0 and amount <= 9000000000000),
  transfer_date date not null,
  created_at timestamptz not null default now(),
  check (source_wallet <> destination_wallet),
  foreign key (household_id, source_wallet) references public.wallets(household_id, name),
  foreign key (household_id, destination_wallet) references public.wallets(household_id, name)
);
create index wallet_transfers_household_idx on public.wallet_transfers(household_id);
alter table public.wallet_transfers enable row level security;
grant select, insert on public.wallet_transfers to authenticated;
create policy "members read transfers" on public.wallet_transfers for select to authenticated
  using (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));
create policy "members create transfers" on public.wallet_transfers for insert to authenticated
  with check (household_id in (select household_id from public.household_members where user_id = (select auth.uid())));

create function public.lock_household_transaction() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.household_id <> new.household_id then
    raise exception 'household cannot change';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((case when tg_op='DELETE' then old.household_id else new.household_id end)::text, 0));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger lock_household_transaction before insert or update or delete on public.transactions
for each row execute function public.lock_household_transaction();

create function public.validate_wallet_transfer() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare available numeric; existing public.wallet_transfers%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.household_id::text, 0));
  select * into existing from public.wallet_transfers where id=new.id;
  if found then
    if (existing.household_id, existing.source_wallet, existing.destination_wallet, existing.amount, existing.transfer_date)
       is distinct from (new.household_id, new.source_wallet, new.destination_wallet, new.amount, new.transfer_date) then
      raise exception 'transfer_id_conflict';
    end if;
    return new;
  end if;
  select coalesce(sum(case when kind='income' then amount else -amount end),0)
    into available from public.transactions where household_id=new.household_id and wallet=new.source_wallet;
  select available + coalesce(sum(case when destination_wallet=new.source_wallet then amount else -amount end),0)
    into available from public.wallet_transfers where household_id=new.household_id
      and (source_wallet=new.source_wallet or destination_wallet=new.source_wallet);
  if available < new.amount then raise exception 'insufficient_wallet_balance'; end if;
  return new;
end $$;
create trigger validate_wallet_transfer before insert on public.wallet_transfers
for each row execute function public.validate_wallet_transfer();

