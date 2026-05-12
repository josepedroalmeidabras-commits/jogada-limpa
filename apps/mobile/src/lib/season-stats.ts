import { supabase } from './supabase';

export type SeasonStats = {
  matches_played: number;
  goals: number;
  assists: number;
};

export async function fetchSeasonStats(
  userId: string,
  sportId = 2, // F7 default
): Promise<SeasonStats> {
  const { data, error } = await supabase
    .from('player_season_stats')
    .select('matches_played, goals, assists')
    .eq('user_id', userId)
    .eq('sport_id', sportId)
    .maybeSingle();
  if (error || !data) {
    return { matches_played: 0, goals: 0, assists: 0 };
  }
  return {
    matches_played: data.matches_played ?? 0,
    goals: data.goals ?? 0,
    assists: data.assists ?? 0,
  };
}

export type TopScorer = {
  user_id: string;
  name: string;
  photo_url: string | null;
  city: string;
  goals: number;
  assists: number;
  matches_played: number;
};

export async function fetchTopScorers(
  city: string | null,
  sportId = 2,
  limit = 20,
): Promise<TopScorer[]> {
  const { data, error } = await supabase.rpc('top_scorers', {
    p_sport_id: sportId,
    p_city: city,
    p_limit: limit,
  });
  if (error || !data) {
    console.error('fetchTopScorers error', error);
    return [];
  }
  return data as TopScorer[];
}
