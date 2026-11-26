-- Rode este arquivo no "SQL Editor" do Supabase (depois do schema.sql e do avaliacoes.sql).
-- Cria as tabelas de alimentos próprios e de planos alimentares.

-- ---------- Alimentos próprios (valores por 100 g, ex.: de rótulos) ----------
create table if not exists public.alimentos_proprios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null,
  categoria  text,
  fonte      text,
  nutrientes jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now()
);

alter table public.alimentos_proprios enable row level security;

drop policy if exists "ver proprios alimentos" on public.alimentos_proprios;
drop policy if exists "criar proprios alimentos" on public.alimentos_proprios;
drop policy if exists "editar proprios alimentos" on public.alimentos_proprios;
drop policy if exists "excluir proprios alimentos" on public.alimentos_proprios;

create policy "ver proprios alimentos" on public.alimentos_proprios
  for select to authenticated using (user_id = auth.uid());
create policy "criar proprios alimentos" on public.alimentos_proprios
  for insert to authenticated with check (user_id = auth.uid());
create policy "editar proprios alimentos" on public.alimentos_proprios
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir proprios alimentos" on public.alimentos_proprios
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.alimentos_proprios to authenticated;

-- ---------- Planos alimentares ----------
create table if not exists public.planos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  paciente_id   uuid not null references public.pacientes(id) on delete cascade,
  nome          text not null,
  data_plano    date not null default current_date,
  metas         jsonb not null default '{}'::jsonb,
  conteudo      jsonb not null default '{"refeicoes":[]}'::jsonb,
  observacoes   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists planos_paciente_idx on public.planos (paciente_id, data_plano desc);

alter table public.planos enable row level security;

drop policy if exists "ver proprios planos" on public.planos;
drop policy if exists "criar proprios planos" on public.planos;
drop policy if exists "editar proprios planos" on public.planos;
drop policy if exists "excluir proprios planos" on public.planos;

create policy "ver proprios planos" on public.planos
  for select to authenticated using (user_id = auth.uid());

create policy "criar proprios planos" on public.planos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
  );

create policy "editar proprios planos" on public.planos
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
  );

create policy "excluir proprios planos" on public.planos
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.planos to authenticated;
