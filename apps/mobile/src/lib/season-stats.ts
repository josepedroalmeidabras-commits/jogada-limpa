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

export type YearStats = {
  year: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
};

export async function fetchPlayerYearStats(
  userId: string,
  sportId = 2,
): Promise<YearStats[]> {
  const { data, error } = await supabase
    .from('player_year_stats')
    .select('year, matches_played, wins, draws, losses, goals, assists')
    .eq('user_id', userId)
    .eq('sport_id', sportId)
    .order('year', { ascending: false });
  if (error || !data) {
    console.error('fetchPlayerYearStats error', error);
    return [];
  }
  return (data as any[]).map((r) => ({
    year: r.year,
    matches_played: r.matches_played ?? 0,
    wins: r.wins ?? 0,
    draws: r.draws ?? 0,
    losses: r.losses ?? 0,
    goals: r.goals ?? 0,
    assists: r.assists ?? 0,
  }));
}

export type MonthStats = {
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  mvps: number;
};

export async function fetchPlayerMonthStats(
  userId: string,
  year: number,
  month: number,
  sportId = 2,
): Promise<MonthStats> {
  const { data, error } = await supabase.rpc('player_month_stats', {
    p_user_id: userId,
    p_year: year,
    p_month: month,
    p_sport_id: sportId,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return {
      matches_played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals: 0,
      assists: 0,
      mvps: 0,
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    matches_played: row.matches_played ?? 0,
    wins: row.wins ?? 0,
    draws: row.draws ?? 0,
    losses: row.losses ?? 0,
    goals: row.goals ?? 0,
    assists: row.assists ?? 0,
    mvps: row.mvps ?? 0,
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
