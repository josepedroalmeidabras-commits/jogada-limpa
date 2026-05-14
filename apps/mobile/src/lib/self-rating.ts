import { supabase } from './supabase';
import { colors } from '../theme';

export type SelfRatingScores = {
  fair_play: number;
  punctuality: number;
  technical_level: number;
};

export async function fetchMySelfRating(
  matchId: string,
): Promise<(SelfRatingScores & { comment: string | null }) | null> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return null;
  const { data, error } = await supabase
    .from('self_ratings')
    .select('fair_play, punctuality, technical_level, comment')
    .eq('user_id', me)
    .eq('match_id', matchId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    fair_play: data.fair_play,
    punctuality: data.punctuality,
    technical_level: data.technical_level,
    comment: data.comment ?? null,
  };
}

export async function submitSelfRating(input: {
  match_id: string;
  scores: SelfRatingScores;
  comment?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('submit_self_rating', {
    p_match_id: input.match_id,
    p_fair_play: input.scores.fair_play,
    p_punctuality: input.scores.punctuality,
    p_technical_level: input.scores.technical_level,
    p_comment: input.comment ?? null,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível guardar.',
    };
  }
  return { ok: true };
}

export type SelfRatingSummary = {
  rated_matches: number;
  avg_self: number;
  avg_others: number;
  avg_delta: number;
  divergent_matches: number;
};

export async function fetchMySelfRatingSummary(): Promise<SelfRatingSummary | null> {
  const { data, error } = await supabase
    .rpc('my_self_rating_summary')
    .single();
  if (error || !data) return null;
  return data as SelfRatingSummary;
}

export type SelfRatingHistoryEntry = {
  match_id: string;
  scheduled_at: string;
  side_a_name: string;
  side_b_name: string;
  final_score_a: number | null;
  final_score_b: number | null;
  self_avg: number;
  others_avg: number;
  avg_delta: number;
  review_count: number;
  self_at: string;
};

export async function fetchMySelfRatingHistory(
  limit = 30,
): Promise<SelfRatingHistoryEntry[]> {
  const { data, error } = await supabase.rpc('fetch_my_self_rating_history', {
    p_limit: limit,
  });
  if (error || !data) {
    console.error('fetchMySelfRatingHistory', error);
    return [];
  }
  return data as SelfRatingHistoryEntry[];
}

// helper to describe a delta in human terms
export function describeDelta(delta: number, reviewCount: number): {
  label: string;
  color: string;
} {
  if (reviewCount < 3) {
    return { label: 'Poucos votos ainda', color: colors.textDim };
  }
  if (delta > 1.0) {
    return { label: 'Sobreavaliaste-te', color: '#fb923c' };
  }
  if (delta < -1.0) {
    return { label: 'Foste subestimado(a)', color: colors.success };
  }
  return { label: 'Em linha', color: colors.textMuted };
}
