do $$ begin
  if exists (select 1 from public.transactions where lower(btrim(wallet))='tabungan')
     or exists (select 1 from public.wallet_transfers where lower(btrim(source_wallet))='tabungan' or lower(btrim(destination_wallet))='tabungan')
     or exists (select 1 from public.wallets where lower(btrim(name))='tabungan' and name<>'Tabungan') then
    raise exception 'existing_savings_wallet_data_requires_review';
  end if;
end $$;
alter table public.wallets add constraint savings_wallet_name_canonical check (lower(btrim(name)) <> 'tabungan' or name = 'Tabungan');
alter table public.transactions drop constraint transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check check (kind in ('income','expense','saving','saving_withdrawal'));
alter table public.transactions drop constraint saving_goal_required;
alter table public.transactions add constraint saving_goal_required check ((kind in ('saving','saving_withdrawal')) = (goal_id is not null));

create function public.prepare_savings_transaction() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.kind in ('saving','saving_withdrawal') then
    if pg_catalog.lower(pg_catalog.btrim(new.wallet)) = 'tabungan' then
      raise exception 'invalid_savings_wallet';
    end if;
    insert into public.wallets (id,household_id,name,kind)
      values (pg_catalog.gen_random_uuid(),new.household_id,'Tabungan','other')
      on conflict (household_id,name) do nothing;
  elsif pg_catalog.lower(pg_catalog.btrim(new.wallet)) = 'tabungan' then
    raise exception 'use_savings_flow';
  end if;
  return new;
end $$;
create trigger prepare_savings_transaction before insert or update on public.transactions
for each row execute function public.prepare_savings_transaction();

create function public.validate_savings_goal() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare target_goal uuid; target_household uuid;
begin
  for target_household,target_goal in
    select distinct x.household_id,x.goal_id from
      (select case when tg_op <> 'INSERT' then old.household_id end household_id, case when tg_op <> 'INSERT' then old.goal_id end goal_id
       union all
       select case when tg_op <> 'DELETE' then new.household_id end, case when tg_op <> 'DELETE' then new.goal_id end) x
    where x.goal_id is not null
  loop
    if (select coalesce(sum(case when kind='saving' then amount when kind='saving_withdrawal' then -amount else 0 end),0)
        from public.transactions where household_id=target_household and goal_id=target_goal) < 0 then
      raise exception 'insufficient_goal_savings';
    end if;
  end loop;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger validate_savings_goal after insert or update or delete on public.transactions
for each row execute function public.validate_savings_goal();

create function public.prevent_savings_wallet_transfer() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if pg_catalog.lower(pg_catalog.btrim(new.source_wallet))='tabungan' or pg_catalog.lower(pg_catalog.btrim(new.destination_wallet))='tabungan' then
    raise exception 'use_savings_flow';
  end if;
  return new;
end $$;
create trigger prevent_savings_wallet_transfer before insert on public.wallet_transfers
for each row execute function public.prevent_savings_wallet_transfer();

create or replace function public.validate_wallet_transfer() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare available numeric; existing public.wallet_transfers%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.household_id::text, 0));
  select * into existing from public.wallet_transfers where id=new.id;
  if found then
    if (existing.household_id,existing.source_wallet,existing.destination_wallet,existing.amount,existing.transfer_date)
       is distinct from (new.household_id,new.source_wallet,new.destination_wallet,new.amount,new.transfer_date) then
      raise exception 'transfer_id_conflict';
    end if;
    return new;
  end if;
  select coalesce(sum(case when kind in ('income','saving_withdrawal') then amount else -amount end),0)
    into available from public.transactions where household_id=new.household_id and wallet=new.source_wallet;
  select available + coalesce(sum(case when destination_wallet=new.source_wallet then amount else -amount end),0)
    into available from public.wallet_transfers where household_id=new.household_id
      and (source_wallet=new.source_wallet or destination_wallet=new.source_wallet);
  if available < new.amount then raise exception 'insufficient_wallet_balance'; end if;
  return new;
end $$;

