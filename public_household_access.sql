grant select, insert, update, delete on public.transactions to anon;
grant select, insert, update on public.goals to anon;
grant select, insert on public.wallets to anon;
grant select, insert, update on public.wallet_transfers to anon;

create policy "public household transactions" on public.transactions
  for all to anon
  using (household_id = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78'::uuid)
  with check (household_id = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78'::uuid);
create policy "public household goals" on public.goals
  for all to anon
  using (household_id = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78'::uuid)
  with check (household_id = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78'::uuid);
create policy "public household wallets" on public.wallets
  for all to anon
  using (household_id = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78'::uuid)
  with check (household_id = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78'::uuid);
create policy "public household transfers" on public.wallet_transfers
  for all to anon
  using (household_id = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78'::uuid)
  with check (household_id = '51f577b1-cdec-45e2-bf5d-a7985fbd0f78'::uuid);
