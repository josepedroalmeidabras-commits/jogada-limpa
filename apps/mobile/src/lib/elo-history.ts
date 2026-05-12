import { supabase } from './supabase';

export type EloHistoryPoint = {
  match_id: string;
  sport_id: number;
  created_at: string;
  elo_before: number;
  elo_after: number;
  delta: number;
};

export async function fetchEloHistory(
  userId: string,
  sportId?: number,
  limit = 30,
): Promise<EloHistoryPoint[]> {
  let query = supabase
    .from('elo_history')
    .select('match_id, sport_id, created_at, elo_before, elo_after, delta')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (sportId !== undefined) query = query.eq('sport_id', sportId);

  const { data, error } = await query;
  if (error || !data) {
    console.error('fetchEloHistory error', error);
    return [];
  }
  return data.map((r: any) => ({
    match_id: r.match_id,
    sport_id: r.sport_id,
    created_at: r.created_at,
    elo_before: Number(r.elo_before),
    elo_after: Number(r.elo_after),
    delta: Number(r.delta),
  }));
}

export function summariseEloHistory(points: EloHistoryPoint[]) {
  if (points.length === 0) {
    return {
      current: 0,
      peak: 0,
      delta_30d: 0,
      best_win: 0,
      worst_loss: 0,
    };
  }
  const current = points[points.length - 1]!.elo_after;
  const peak = points.reduce(
    (max, p) => (p.elo_after > max ? p.elo_after : max),
    0,
  );
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const oldPoints = points.filter(
    (p) => new Date(p.created_at).getTime() <= thirtyDaysAgo,
  );
  const baseline =
    oldPoints.length > 0
      ? oldPoints[oldPoints.length - 1]!.elo_after
      : points[0]!.elo_before;
  const delta_30d = current - baseline;
  const best_win = points.reduce(
    (max, p) => (p.delta > max ? p.delta : max),
    0,
  );
  const worst_loss = points.reduce(
    (min, p) => (p.delta < min ? p.delta : min),
    0,
  );
  return {
    current: Math.round(current),
    peak: Math.round(peak),
    delta_30d: Math.round(delta_30d),
    best_win: Math.round(best_win),
    worst_loss: Math.round(worst_loss),
  };
}
