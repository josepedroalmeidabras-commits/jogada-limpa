import { supabase } from './supabase';

export type HeadToHead = {
  played: number;
  a_wins: number;
  b_wins: number;
  draws: number;
  a_goals: number;
  b_goals: number;
  last_played: string | null;
};

export async function fetchHeadToHead(
  teamA: string,
  teamB: string,
): Promise<HeadToHead> {
  const { data, error } = await supabase
    .rpc('team_head_to_head', { p_team_a: teamA, p_team_b: teamB })
    .single();
  if (error || !data) {
    return {
      played: 0,
      a_wins: 0,
      b_wins: 0,
      draws: 0,
      a_goals: 0,
      b_goals: 0,
      last_played: null,
    };
  }
  return data as HeadToHead;
}

export type SuggestedOpponent = {
  team_id: string;
  name: string;
  photo_url: string | null;
  elo_avg: number;
  member_count: number;
  elo_diff: number;
  played_us: number;
};

export async function fetchSuggestedOpponents(
  myTeamId: string,
  limit = 5,
): Promise<SuggestedOpponent[]> {
  const { data, error } = await supabase.rpc('suggested_opponents', {
    p_my_team_id: myTeamId,
    p_limit: limit,
  });
  if (error || !data) {
    console.error('fetchSuggestedOpponents error', error);
    return [];
  }
  return (data as any[]).map((r) => ({
    team_id: r.team_id,
    name: r.name,
    photo_url: r.photo_url,
    elo_avg: Number(r.elo_avg),
    member_count: r.member_count,
    elo_diff: Number(r.elo_diff),
    played_us: r.played_us,
  }));
}
