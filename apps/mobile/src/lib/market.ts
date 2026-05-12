import { supabase } from './supabase';

export type FreeAgent = {
  user_id: string;
  sport_id: number;
  name: string;
  city: string;
  photo_url: string | null;
  elo: number;
  matches_played: number;
  open_until: string | null;
};

export async function fetchFreeAgents(
  sportId: number,
  excludeUserIds: string[],
): Promise<FreeAgent[]> {
  const { data, error } = await supabase
    .from('user_sports')
    .select(
      `user_id, sport_id, elo, matches_played, open_to_team_until,
       profile:profiles!inner(id, name, city, photo_url, deleted_at)`,
    )
    .eq('sport_id', sportId)
    .eq('is_open_to_team', true)
    .or(`open_to_team_until.is.null,open_to_team_until.gt.${new Date().toISOString()}`);
  if (error || !data) {
    console.error('fetchFreeAgents error', error);
    return [];
  }
  const excluded = new Set(excludeUserIds);
  return (data as any[])
    .filter((r) => !excluded.has(r.user_id))
    .filter((r) => r.profile && !r.profile.deleted_at)
    .map(
      (r): FreeAgent => ({
        user_id: r.user_id,
        sport_id: r.sport_id,
        name: r.profile.name,
        city: r.profile.city,
        photo_url: r.profile.photo_url,
        elo: Number(r.elo),
        matches_played: r.matches_played,
        open_until: r.open_to_team_until,
      }),
    )
    .sort((a, b) => b.elo - a.elo);
}

export async function setOpenToTeam(
  userId: string,
  sportId: number,
  isOpen: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const openUntil = isOpen
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const { error } = await supabase
    .from('user_sports')
    .update({
      is_open_to_team: isOpen,
      open_to_team_until: openUntil,
    })
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

export type DiscoverableTeam = {
  team_id: string;
  name: string;
  city: string;
  photo_url: string | null;
  sport_id: number;
  captain_id: string;
  invite_code: string;
  elo_avg: number;
  member_count: number;
};

export async function fetchDiscoverableTeams(
  sportId: number,
  city: string,
  excludeTeamIds: string[],
): Promise<DiscoverableTeam[]> {
  const { data: teams, error } = await supabase
    .from('teams')
    .select(
      'id, name, city, photo_url, sport_id, captain_id, invite_code, is_active',
    )
    .eq('sport_id', sportId)
    .eq('city', city)
    .eq('is_active', true);
  if (error || !teams) return [];

  const filtered = teams.filter((t) => !excludeTeamIds.includes(t.id));
  if (filtered.length === 0) return [];

  const { data: stats } = await supabase
    .from('team_elo')
    .select('team_id, elo_avg, member_count')
    .in(
      'team_id',
      filtered.map((t) => t.id),
    );

  const statMap = new Map(
    (stats ?? []).map((s: any) => [
      s.team_id,
      { elo_avg: Number(s.elo_avg), member_count: s.member_count },
    ]),
  );

  return filtered
    .map(
      (t): DiscoverableTeam => ({
        team_id: t.id,
        name: t.name,
        city: t.city,
        photo_url: t.photo_url,
        sport_id: t.sport_id,
        captain_id: t.captain_id,
        invite_code: t.invite_code,
        elo_avg: statMap.get(t.id)?.elo_avg ?? 1200,
        member_count: statMap.get(t.id)?.member_count ?? 0,
      }),
    )
    .sort((a, b) => b.elo_avg - a.elo_avg);
}

export async function inviteFreeAgent(input: {
  team_id: string;
  user_id: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('invite_free_agent', {
    p_team_id: input.team_id,
    p_user_id: input.user_id,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível convidar.',
    };
  }
  return { ok: true };
}
