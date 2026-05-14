-- =============================================================================
-- TEAM FACEOFF LEADERBOARD
-- =============================================================================
-- Agrega os votos de team_faceoff_votes em ranking por equipa: quem é o
-- jogador mais votado como "melhor" nos faceoffs internos. Empates contam
-- como meia-vitória para cada lado, mantendo o range coerente.

create or replace function public.team_faceoff_leaderboard(
  p_team_id uuid,
  p_limit   int default 10
)
returns table (
  user_id       uuid,
  name          text,
  photo_url     text,
  wins          int,
  losses        int,
  draws         int,
  total_votes   int,
  win_score     numeric  -- 0..1
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  -- Restringe a membros da equipa (leaderboard é semi-privado, vê-se na equipa).
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = v_user
  ) then
    raise exception 'Only team members can see the faceoff leaderboard';
  end if;

  return query
    with per_player as (
      -- Wins: votes where this player was the winner
      select winner_id as uid, count(*)::int as wins, 0::int as losses, 0::int as draws
      from public.team_faceoff_votes
      where team_id = p_team_id and winner_id is not null
      group by winner_id
      union all
      -- Losses: votes where this player was the loser
      select
        case when winner_id = player_low then player_high else player_low end as uid,
        0::int as wins,
        count(*)::int as losses,
        0::int as draws
      from public.team_faceoff_votes
      where team_id = p_team_id and winner_id is not null
      group by uid
      union all
      -- Draws: both sides involved in the pair get a draw
      select player_low as uid, 0::int as wins, 0::int as losses, count(*)::int as draws
      from public.team_faceoff_votes
      where team_id = p_team_id and winner_id is null
      group by player_low
      union all
      select player_high as uid, 0::int as wins, 0::int as losses, count(*)::int as draws
      from public.team_faceoff_votes
      where team_id = p_team_id and winner_id is null
      group by player_high
    ),
    tot as (
      select
        uid,
        sum(wins)::int   as w,
        sum(losses)::int as l,
        sum(draws)::int  as d
      from per_player
      group by uid
    )
    select
      t.uid                                                 as user_id,
      p.name                                                as name,
      p.photo_url                                           as photo_url,
      t.w                                                   as wins,
      t.l                                                   as losses,
      t.d                                                   as draws,
      (t.w + t.l + t.d)                                     as total_votes,
      case
        when (t.w + t.l + t.d) = 0 then 0::numeric
        else round(
          ((t.w::numeric + (t.d::numeric / 2)) / (t.w + t.l + t.d)) * 100,
          0
        )
      end                                                   as win_score
    from tot t
    join public.profiles p on p.id = t.uid
    where p.deleted_at is null
    order by win_score desc, t.w desc, total_votes desc
    limit p_limit;
end;
$$;

revoke all on function public.team_faceoff_leaderboard(uuid, int) from public, anon;
grant execute on function public.team_faceoff_leaderboard(uuid, int) to authenticated;
