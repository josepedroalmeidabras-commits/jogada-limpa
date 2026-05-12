import { supabase } from './supabase';

export type RatingHistoryEntry = {
  match_id: string;
  scheduled_at: string;
  side_a_name: string;
  side_b_name: string;
  my_side: 'A' | 'B';
  final_score_a: number | null;
  final_score_b: number | null;
  avg_rating: number;
  review_count: number;
};

export async function fetchUserRatingHistory(
  userId: string,
  limit = 12,
): Promise<RatingHistoryEntry[]> {
  const { data, error } = await supabase.rpc('fetch_user_rating_history', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error || !data) {
    console.error('fetchUserRatingHistory error', error);
    return [];
  }
  return (data as any[]).map((r) => ({
    match_id: r.match_id,
    scheduled_at: r.scheduled_at,
    side_a_name: r.side_a_name,
    side_b_name: r.side_b_name,
    my_side: r.my_side,
    final_score_a: r.final_score_a,
    final_score_b: r.final_score_b,
    avg_rating: Number(r.avg_rating),
    review_count: r.review_count,
  })) as RatingHistoryEntry[];
}

export function ratingTierColor(value: number): string {
  if (value >= 4.2) return '#C9A26B'; // green
  if (value >= 3.5) return '#facc15'; // yellow
  if (value >= 2.8) return '#fb923c'; // orange
  return '#f87171'; // red
}

export function ratingAverage(rows: RatingHistoryEntry[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, r) => acc + r.avg_rating, 0);
  return Math.round((sum / rows.length) * 10) / 10;
}
