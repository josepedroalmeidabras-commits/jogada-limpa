-- =============================================================================
-- MVP voting: cada participante de um match validated vota 1 colega
-- =============================================================================
-- Regras:
--  * Votar = INSERT em match_mvp_votes (match_id, voter_id, mvp_user_id).
--  * Voter tem de ter sido participante COM presença ('attended' / 'substitute_in').
--  * Voto único por (match_id, voter_id). Para mudar, terias de DELETE + INSERT.
--  * Match tem de estar 'validated'.
--  * mvp_user_id pode ser de qualquer lado (votas em colegas OU adversários).

create table public.match_mvp_votes (
  match_id     uuid not null references public.matches(id) on delete cascade,
  voter_id     uuid not null references public.profiles(id) on delete cascade,
  mvp_user_id  uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (match_id, voter_id),
  check (voter_id <> mvp_user_id)
);

create index idx_mvp_votes_mvp on public.match_mvp_votes(mvp_user_id);
create index idx_mvp_votes_match on public.match_mvp_votes(match_id);

alter table public.match_mvp_votes enable row level security;

-- Voter pode escrever só o seu voto, se cumprir critérios
create policy "mvp_votes_insert"
  on public.match_mvp_votes for insert to authenticated
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.status = 'validated'
    )
    and exists (
      select 1 from public.match_participants mp
      where mp.match_id = match_mvp_votes.match_id
        and mp.user_id = auth.uid()
        and mp.attendance in ('attended','substitute_in')
    )
  );

-- Voter pode ler/eliminar o próprio voto; todos podem ler agregados via view
create policy "mvp_votes_select_own"
  on public.match_mvp_votes for select to authenticated
  using (auth.uid() = voter_id);

create policy "mvp_votes_delete_own"
  on public.match_mvp_votes for delete to authenticated
  using (auth.uid() = voter_id);

-- View agregada com total de votos por user (pública)
create or replace view public.mvp_totals as
select
  mvp_user_id as user_id,
  count(*)::int as mvp_votes
from public.match_mvp_votes
group by mvp_user_id;
