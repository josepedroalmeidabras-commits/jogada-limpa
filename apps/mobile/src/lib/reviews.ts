import { supabase } from './supabase';

export type ReviewCategory =
  | 'fair_play'
  | 'punctuality'
  | 'technical_level'
  | 'attitude';

export type ReviewInput = {
  match_id: string;
  reviewed_id: string;
  role: 'opponent' | 'teammate';
  fair_play: number;
  punctuality: number;
  technical_level: number;
  attitude: number;
  comment?: string;
};

export async function submitReview(
  input: ReviewInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.from('reviews').insert({
    match_id: input.match_id,
    reviewed_id: input.reviewed_id,
    role: input.role,
    fair_play: input.fair_play,
    punctuality: input.punctuality,
    technical_level: input.technical_level,
    attitude: input.attitude,
    comment: input.comment ?? null,
  });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, message: 'Já submeteste esta avaliação.' };
    }
    return {
      ok: false,
      message: error.message ?? 'Não foi possível submeter.',
    };
  }
  return { ok: true };
}

export async function fetchMyReviewsForMatch(
  matchId: string,
  reviewerId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('reviews')
    .select('reviewed_id')
    .eq('match_id', matchId)
    .eq('reviewer_id', reviewerId);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.reviewed_id));
}

export type ReviewAggregate = {
  user_id: string;
  total_reviews: number;
  avg_fair_play: number;
  avg_punctuality: number;
  avg_technical_level: number;
  avg_attitude: number;
};

export async function fetchReviewAggregate(
  userId: string,
): Promise<ReviewAggregate | null> {
  const { data, error } = await supabase
    .from('review_aggregates')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchReviewAggregate error', error);
    return null;
  }
  return data as ReviewAggregate | null;
}

export type UserSportElo = {
  sport_id: number;
  declared_level: number | null;
  elo: number;
  matches_played: number;
  is_open_to_sub: boolean;
  open_until: string | null;
  is_open_to_team: boolean;
  open_to_team_until: string | null;
  sport: { id: number; name: string; code: string } | null;
};

export async function fetchUserSports(
  userId: string,
): Promise<UserSportElo[]> {
  const { data, error } = await supabase
    .from('user_sports')
    .select(
      `sport_id, declared_level, elo, matches_played,
       is_open_to_sub, open_until,
       is_open_to_team, open_to_team_until,
       sport:sports!inner(id, name, code, is_active)`,
    )
    .eq('user_id', userId);
  if (error || !data) {
    console.error('fetchUserSports error', error);
    return [];
  }
  // Hide ELO/availability for sports that are no longer active (F5/F11
  // after the F7 pivot, padel, etc).
  return (data as any[]).filter((r) => r.sport?.is_active) as UserSportElo[];
}

export async function setSportAvailability(
  userId: string,
  sportId: number,
  isOpen: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const openUntil = isOpen
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { error } = await supabase
    .from('user_sports')
    .update({ is_open_to_sub: isOpen, open_until: openUntil })
    .eq('user_id', userId)
    .eq('sport_id', sportId);
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível guardar.',
    };
  }
  return { ok: true };
}
