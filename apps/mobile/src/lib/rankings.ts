import { supabase } from './supabase';

export type RankedPlayer = {
  user_id: string;
  name: string;
  city: string;
  photo_url: string | null;
  win_pct: number;
  matches: number;
};

export type RankedTeam = {
  team_id: string;
  name: string;
  city: string;
  photo_url: string | null;
  win_pct: number;
  matches: number;
  member_count: number;
};

export async function fetchTopPlayers(
  sportId: number,
  city: string | null,
  limit = 20,
): Promise<RankedPlayer[]> {
  // Rankings só contam jogos de competição (amigáveis) — peladinhas
  // só contam para o win% global do perfil.
  const { data, error } = await supabase
    .from('user_win_stats')
    .select(
      `user_id, comp_win_pct, comp_matches,
       profile:profiles!inner(id, name, city, photo_url, deleted_at)`,
    )
    .eq('sport_id', sportId)
    .gte('comp_matches', 1)
    .order('comp_win_pct', { ascending: false })
    .order('comp_matches', { ascending: false })
    .limit(limit * 2);

  if (error || !data) {
    console.error('fetchTopPlayers error', error);
    return [];
  }
  return (data as any[])
    .filter((r) => r.profile && !r.profile.deleted_at)
    .filter((r) => !city || r.profile.city === city)
    .slice(0, limit)
    .map(
      (r): RankedPlayer => ({
        user_id: r.user_id,
        name: r.profile.name,
        city: r.profile.city,
        photo_url: r.profile.photo_url,
        win_pct: Number(r.comp_win_pct),
        matches: r.comp_matches,
      }),
    );
}

export type RankedMvp = {
  user_id: string;
  name: string;
  city: string;
  photo_url: string | null;
  mvp_votes: number;
};

export async function fetchTopMvps(
  city: string | null,
  limit = 20,
): Promise<RankedMvp[]> {
  const { data, error } = await supabase
    .from('mvp_totals')
    .select(
      `user_id, mvp_votes,
       profile:profiles!inner(id, name, city, photo_url, deleted_at)`,
    )
    .order('mvp_votes', { ascending: false })
    .limit(limit * 2); // overfetch then filter

  if (error || !data) {
    console.error('fetchTopMvps error', error);
    return [];
  }

  return (data as any[])
    .filter((r) => r.profile && !r.profile.deleted_at)
    .filter((r) => !city || r.profile.city === city)
    .map(
      (r): RankedMvp => ({
        user_id: r.user_id,
        name: r.profile.name,
        city: r.profile.city,
        photo_url: r.profile.photo_url,
        mvp_votes: r.mvp_votes,
      }),
    )
    .slice(0, limit);
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

  const teamIds = filteredTeams.map((t) => t.id);

  const [{ data: wins }, { data: elos }] = await Promise.all([
    supabase
      .from('team_win_stats')
      .select('team_id, win_pct, matches')
      .in('team_id', teamIds),
    supabase
      .from('team_elo')
      .select('team_id, member_count')
      .in('team_id', teamIds),
  ]);

  const winMap = new Map(
    (wins ?? []).map((w: any) => [
      w.team_id,
      { win_pct: Number(w.win_pct), matches: w.matches },
    ]),
  );
  const memberMap = new Map(
    (elos ?? []).map((s: any) => [s.team_id, s.member_count]),
  );

  return filteredTeams
    .map(
      (t): RankedTeam => ({
        team_id: t.id,
        name: t.name,
        city: t.city,
        photo_url: t.photo_url,
        win_pct: winMap.get(t.id)?.win_pct ?? 0,
        matches: winMap.get(t.id)?.matches ?? 0,
        member_count: memberMap.get(t.id) ?? 0,
      }),
    )
    .sort((a, b) => {
      // Sort by win_pct desc, tiebreak on matches
      if (b.win_pct !== a.win_pct) return b.win_pct - a.win_pct;
      return b.matches - a.matches;
    })
    .slice(0, limit);
}
