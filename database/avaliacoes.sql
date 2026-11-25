-- Rode este arquivo no "SQL Editor" do Supabase (depois do schema.sql dos pacientes).
-- Cria a tabela de avaliações físicas, ligada a cada paciente.

create table if not exists public.avaliacoes (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  paciente_id               uuid not null references public.pacientes(id) on delete cascade,
  data_avaliacao            date not null default current_date,
  peso                      numeric(5,2),
  altura                    numeric(5,1),
  dobras                    jsonb not null default '{}'::jsonb,
  circunferencias           jsonb not null default '{}'::jsonb,
  protocolo                 text,
  percentual_gordura_manual numeric(4,1),
  fator_atividade           numeric(3,2),
  observacoes               text,
  criado_em                 timestamptz not null default now()
);

create index if not exists avaliacoes_paciente_idx on public.avaliacoes (paciente_id, data_avaliacao);

-- Segurança: cada usuário só enxerga e altera as próprias avaliações,
-- e só de pacientes que também são dele.
alter table public.avaliacoes enable row level security;

drop policy if exists "ver proprias avaliacoes" on public.avaliacoes;
drop policy if exists "criar proprias avaliacoes" on public.avaliacoes;
drop policy if exists "editar proprias avaliacoes" on public.avaliacoes;
drop policy if exists "excluir proprias avaliacoes" on public.avaliacoes;

create policy "ver proprias avaliacoes" on public.avaliacoes
  for select to authenticated using (user_id = auth.uid());

create policy "criar proprias avaliacoes" on public.avaliacoes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
  );

create policy "editar proprias avaliacoes" on public.avaliacoes
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.pacientes p where p.id = paciente_id and p.user_id = auth.uid())
  );

create policy "excluir proprias avaliacoes" on public.avaliacoes
  for delete to authenticated using (user_id = auth.uid());

-- Permissão básica para quem está logado (as regras acima limitam quais linhas cada um vê).
grant select, insert, update, delete on public.avaliacoes to authenticated;
