-- Cole este arquivo inteiro no "SQL Editor" do Supabase e clique em Run.

create table if not exists public.pacientes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome             text not null,
  data_nascimento  date,
  sexo             text,
  telefone         text,
  email            text,
  objetivo         text,
  observacoes      text,
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now()
);

create index if not exists pacientes_user_idx on public.pacientes (user_id);

-- Segurança: cada usuário só enxerga e altera os próprios registros.
alter table public.pacientes enable row level security;

create policy "ver proprios pacientes" on public.pacientes
  for select to authenticated using (user_id = auth.uid());

create policy "criar proprios pacientes" on public.pacientes
  for insert to authenticated with check (user_id = auth.uid());

create policy "editar proprios pacientes" on public.pacientes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "excluir proprios pacientes" on public.pacientes
  for delete to authenticated using (user_id = auth.uid());

-- Permissão básica para quem está logado (as regras acima limitam quais linhas cada um vê).
grant select, insert, update, delete on public.pacientes to authenticated;
