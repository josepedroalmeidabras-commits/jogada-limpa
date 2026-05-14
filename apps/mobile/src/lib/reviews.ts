import { supabase } from './supabase';

export type ReviewCategory =
  | 'fair_play'
  | 'punctuality'
  | 'technical_level';

export type ReviewInput = {
  match_id: string;
  reviewed_id: string;
  role: 'opponent' | 'teammate';
  overall: number; // 1-5 stars
  comment?: string;
};

export async function submitReview(
  input: ReviewInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = Math.max(1, Math.min(5, Math.round(input.overall)));
  const { error } = await supabase.from('reviews').insert({
    match_id: input.match_id,
    reviewed_id: input.reviewed_id,
    role: input.role,
    fair_play: v,
    punctuality: v,
    technical_level: v,
    overall: v,
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
  avg_overall: number;
  avg_fair_play: number;
  avg_punctuality: number;
  avg_technical_level: number;
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

export type TeamReviewInput = {
  match_id: string;
  team_id: string;
  overall: number; // 1-5
  comment?: string;
};

export async function submitTeamReview(
  input: TeamReviewInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = Math.max(1, Math.min(5, Math.round(input.overall)));
  const { error } = await supabase.rpc('submit_team_review', {
    p_match_id: input.match_id,
    p_team_id: input.team_id,
    p_overall: v,
    p_comment: input.comment ?? null,
  });
  if (error) return { ok: false, message: error.message ?? 'Falhou.' };
  return { ok: true };
}

export async function hasReviewedTeam(
  matchId: string,
  teamId: string,
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return false;
  const { count, error } = await supabase
    .from('team_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .eq('reviewer_id', me)
    .eq('reviewed_team_id', teamId);
  if (error) return false;
  return (count ?? 0) > 0;
}

export type TeamReviewAggregate = {
  team_id: string;
  total_reviews: number;
  avg_overall: number;
  avg_fair_play: number;
  avg_punctuality: number;
  avg_technical_level: number;
};

export async function fetchTeamReviewAggregate(
  teamId: string,
): Promise<TeamReviewAggregate | null> {
  const { data, error } = await supabase
    .from('team_review_aggregates')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle();
  if (error || !data) return null;
  return data as TeamReviewAggregate;
}

export type UserSportElo = {
  sport_id: number;
  declared_level: number | null;
  elo: number;
  matches_played: number;
  win_pct: number;
  win_matches: number;
  comp_win_pct: number;
  comp_matches: number;
  pel_win_pct: number;
  pel_matches: number;
  is_open_to_sub: boolean;
  open_until: string | null;
  is_open_to_team: boolean;
  open_to_team_until: string | null;
  preferred_position: string | null;
  sport: { id: number; name: string; code: string } | null;
};

export async function fetchUserSports(
  userId: string,
): Promise<UserSportElo[]> {
  const [{ data, error }, { data: winStats }] = await Promise.all([
    supabase
      .from('user_sports')
      .select(
        `sport_id, declared_level, elo, matches_played,
         is_open_to_sub, open_until,
         is_open_to_team, open_to_team_until,
         preferred_position,
         sport:sports!inner(id, name, code, is_active)`,
      )
      .eq('user_id', userId),
    supabase
      .from('user_win_stats')
      .select(
        'sport_id, win_pct, matches, comp_win_pct, comp_matches, pel_win_pct, pel_matches',
      )
      .eq('user_id', userId),
  ]);
  if (error || !data) {
    console.error('fetchUserSports error', error);
    return [];
  }
  const winMap = new Map(
    (winStats ?? []).map((w: any) => [
      w.sport_id as number,
      {
        win_pct: Number(w.win_pct),
        matches: w.matches as number,
        comp_win_pct: Number(w.comp_win_pct),
        comp_matches: w.comp_matches as number,
        pel_win_pct: Number(w.pel_win_pct),
        pel_matches: w.pel_matches as number,
      },
    ]),
  );
  // Hide rows for inactive sports (F5/F11 etc).
  return (data as any[])
    .filter((r) => r.sport?.is_active)
    .map((r): UserSportElo => ({
      sport_id: r.sport_id,
      declared_level: r.declared_level,
      elo: r.elo,
      matches_played: r.matches_played,
      win_pct: winMap.get(r.sport_id)?.win_pct ?? 0,
      win_matches: winMap.get(r.sport_id)?.matches ?? 0,
      comp_win_pct: winMap.get(r.sport_id)?.comp_win_pct ?? 0,
      comp_matches: winMap.get(r.sport_id)?.comp_matches ?? 0,
      pel_win_pct: winMap.get(r.sport_id)?.pel_win_pct ?? 0,
      pel_matches: winMap.get(r.sport_id)?.pel_matches ?? 0,
      is_open_to_sub: r.is_open_to_sub,
      open_until: r.open_until,
      is_open_to_team: r.is_open_to_team,
      open_to_team_until: r.open_to_team_until,
      preferred_position: r.preferred_position,
      sport: r.sport,
    }));
}

export async function fetchPreferredPosition(
  userId: string,
  sportId = 2,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_sports')
    .select('preferred_position')
    .eq('user_id', userId)
    .eq('sport_id', sportId)
    .maybeSingle();
  if (error || !data) return null;
  return data.preferred_position ?? null;
}

export async function setPreferredPosition(
  userId: string,
  sportId: number,
  position: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('user_sports')
    .update({ preferred_position: position })
    .eq('user_id', userId)
    .eq('sport_id', sportId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
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
