import { supabase } from './supabase';

export type FaceoffTally = {
  votes_for_a: number;
  votes_for_b: number;
  draws: number;
  my_vote: 'a' | 'b' | 'draw' | null;
};

export async function fetchFaceoffTally(
  teamId: string,
  playerA: string,
  playerB: string,
): Promise<FaceoffTally> {
  const { data, error } = await supabase
    .rpc('fetch_faceoff_tally', {
      p_team_id: teamId,
      p_player_a: playerA,
      p_player_b: playerB,
    })
    .single();
  if (error || !data) {
    return { votes_for_a: 0, votes_for_b: 0, draws: 0, my_vote: null };
  }
  const r = data as any;
  return {
    votes_for_a: r.votes_for_a ?? 0,
    votes_for_b: r.votes_for_b ?? 0,
    draws: r.draws ?? 0,
    my_vote: (r.my_vote as FaceoffTally['my_vote']) ?? null,
  };
}

export type FaceoffLeaderboardEntry = {
  user_id: string;
  name: string;
  photo_url: string | null;
  wins: number;
  losses: number;
  draws: number;
  total_votes: number;
  win_score: number; // 0..100
};

export async function fetchTeamFaceoffLeaderboard(
  teamId: string,
  limit = 5,
): Promise<FaceoffLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('team_faceoff_leaderboard', {
    p_team_id: teamId,
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    user_id: r.user_id,
    name: r.name,
    photo_url: r.photo_url ?? null,
    wins: r.wins ?? 0,
    losses: r.losses ?? 0,
    draws: r.draws ?? 0,
    total_votes: r.total_votes ?? 0,
    win_score: Number(r.win_score ?? 0),
  }));
}

export async function castFaceoffVote(
  teamId: string,
  playerA: string,
  playerB: string,
  winnerId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('cast_faceoff_vote', {
    p_team_id: teamId,
    p_player_a: playerA,
    p_player_b: playerB,
    p_winner_id: winnerId,
  });
  if (error) return { ok: false, message: error.message ?? 'Falhou o voto.' };
  return { ok: true };
}
