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

export async function fetchMvpCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('mvp_totals')
    .select('mvp_votes')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return 0;
  return data.mvp_votes ?? 0;
}
