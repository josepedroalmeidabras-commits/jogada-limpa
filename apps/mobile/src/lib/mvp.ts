import { supabase } from './supabase';

export async function castMvpVote(input: {
  match_id: string;
  mvp_user_id: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('match_mvp_votes').insert({
    match_id: input.match_id,
    voter_id: (await supabase.auth.getUser()).data.user?.id,
    mvp_user_id: input.mvp_user_id,
  });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'Já votaste para este jogo.' };
    }
    if (error.code === '23514') {
      return { ok: false, message: 'Não podes votar em ti.' };
    }
    return {
      ok: false,
      message: error.message ?? 'Não foi possível votar.',
    };
  }
  return { ok: true };
}

export async function fetchMyMvpVote(
  matchId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('match_mvp_votes')
    .select('mvp_user_id')
    .eq('match_id', matchId)
    .maybeSingle();
  if (error || !data) return null;
  return data.mvp_user_id as string;
}

export type MvpWinner = {
  user_id: string;
  name: string;
  photo_url: string | null;
  votes: number;
};

export async function fetchMatchMvpWinner(
  matchId: string,
): Promise<MvpWinner | null> {
  const { data, error } = await supabase
    .from('match_mvp_votes')
    .select('mvp_user_id')
    .eq('match_id', matchId);
  if (error || !data || data.length === 0) return null;

  const counts = new Map<string, number>();
  for (const r of data as Array<{ mvp_user_id: string }>) {
    counts.set(r.mvp_user_id, (counts.get(r.mvp_user_id) ?? 0) + 1);
  }
  let winner: string | null = null;
  let max = 0;
  for (const [uid, n] of counts) {
    if (n > max) {
      max = n;
      winner = uid;
    }
  }
  if (!winner) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, photo_url')
    .eq('id', winner)
    .maybeSingle();
  if (!profile) return null;
  return {
    user_id: profile.id,
    name: profile.name,
    photo_url: profile.photo_url,
    votes: max,
  };
}

export async function fetchMvpCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('mvp_totals')
    .select('mvp_votes')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return 0;
  return data.mvp_votes ?? 0;
}
