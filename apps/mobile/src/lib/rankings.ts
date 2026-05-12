import { supabase } from './supabase';

export type RankedPlayer = {
  user_id: string;
  name: string;
  city: string;
  photo_url: string | null;
  elo: number;
  matches_played: number;
};

export type RankedTeam = {
  team_id: string;
  name: string;
  city: string;
  photo_url: string | null;
  elo_avg: number;
  member_count: number;
};

export async function fetchTopPlayers(
  sportId: number,
  city: string | null,
  limit = 20,
): Promise<RankedPlayer[]> {
  let query = supabase
    .from('user_sports')
    .select(
      `user_id, elo, matches_played,
       profile:profiles!inner(id, name, city, photo_url, deleted_at)`,
    )
    .eq('sport_id', sportId)
    .gte('matches_played', 1)
    .order('elo', { ascending: false })
    .limit(limit);

  const { data, error } = await query;
  if (error || !data) {
    console.error('fetchTopPlayers error', error);
    return [];
  }
  return (data as any[])
    .filter((r) => r.profile && !r.profile.deleted_at)
    .filter((r) => !city || r.profile.city === city)
    .map(
      (r): RankedPlayer => ({
        user_id: r.user_id,
        name: r.profile.name,
        city: r.profile.city,
        photo_url: r.profile.photo_url,
        elo: Number(r.elo),
        matches_played: r.matches_played,
      }),
    );
}

export async function fetchTopTeams(
  sportId: number,
  city: string | null,
  limit = 20,
): Promise<RankedTeam[]> {
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, city, photo_url, sport_id, is_active')
    .eq('sport_id', sportId)
    .eq('is_active', true);
  if (error || !teams) return [];

  const filteredTeams = city ? teams.filter((t) => t.city === city) : teams;
  if (filteredTeams.length === 0) return [];

  const { data: stats } = await supabase
    .from('team_elo')
    .select('team_id, elo_avg, member_count')
    .in(
      'team_id',
      filteredTeams.map((t) => t.id),
    );

  const statMap = new Map(
    (stats ?? []).map((s: any) => [
      s.team_id,
      { elo_avg: Number(s.elo_avg), member_count: s.member_count },
    ]),
  );

  return filteredTeams
    .map(
      (t): RankedTeam => ({
        team_id: t.id,
        name: t.name,
        city: t.city,
        photo_url: t.photo_url,
        elo_avg: statMap.get(t.id)?.elo_avg ?? 1200,
        member_count: statMap.get(t.id)?.member_count ?? 0,
      }),
    )
    .sort((a, b) => b.elo_avg - a.elo_avg)
    .slice(0, limit);
}
