import { supabase } from './supabase';

export type MatchStatus =
  | 'proposed'
  | 'confirmed'
  | 'result_pending'
  | 'validated'
  | 'disputed'
  | 'cancelled';

export type TeamLite = {
  id: string;
  name: string;
  city: string;
  captain_id: string;
};

export type MatchSummary = {
  id: string;
  sport_id: number;
  scheduled_at: string;
  status: MatchStatus;
  location_name: string | null;
  location_tbd: boolean;
  message: string | null;
  proposed_by: string;
  final_score_a: number | null;
  final_score_b: number | null;
  side_a: TeamLite;
  side_b: TeamLite;
};

type SideRow = {
  side: 'A' | 'B';
  team: TeamLite | null;
};

function unwrapSides(raw: any[]): { a: TeamLite | null; b: TeamLite | null } {
  let a: TeamLite | null = null;
  let b: TeamLite | null = null;
  for (const row of raw as SideRow[]) {
    if (row.side === 'A') a = row.team;
    else if (row.side === 'B') b = row.team;
  }
  return { a, b };
}

const MATCH_SELECT = `
  id, sport_id, scheduled_at, status, location_name, location_tbd,
  message, proposed_by, final_score_a, final_score_b,
  sides:match_sides!inner(
    side,
    team:teams!inner(id, name, city, captain_id)
  )
`;

export async function fetchMatchesForTeam(
  teamId: string,
): Promise<MatchSummary[]> {
  // First grab match ids where the team is involved
  const { data: sideRows, error: sideErr } = await supabase
    .from('match_sides')
    .select('match_id')
    .eq('team_id', teamId);
  if (sideErr || !sideRows) {
    console.error('fetchMatchesForTeam sides error', sideErr);
    return [];
  }
  const matchIds = sideRows.map((r) => r.match_id);
  if (matchIds.length === 0) return [];

  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .in('id', matchIds)
    .in('status', ['proposed', 'confirmed', 'result_pending', 'disputed'])
    .order('scheduled_at', { ascending: true });

  if (error || !data) {
    console.error('fetchMatchesForTeam error', error);
    return [];
  }

  return data
    .map((m: any): MatchSummary | null => {
      const { a, b } = unwrapSides(m.sides ?? []);
      if (!a || !b) return null;
      return {
        id: m.id,
        sport_id: m.sport_id,
        scheduled_at: m.scheduled_at,
        status: m.status,
        location_name: m.location_name,
        location_tbd: m.location_tbd,
        message: m.message,
        proposed_by: m.proposed_by,
        final_score_a: m.final_score_a,
        final_score_b: m.final_score_b,
        side_a: a,
        side_b: b,
      };
    })
    .filter((m): m is MatchSummary => !!m);
}

export async function fetchMatchById(
  matchId: string,
): Promise<MatchSummary | null> {
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('id', matchId)
    .maybeSingle();

  if (error || !data) {
    console.error('fetchMatchById error', error);
    return null;
  }
  const m = data as any;
  const { a, b } = unwrapSides(m.sides ?? []);
  if (!a || !b) return null;
  return {
    id: m.id,
    sport_id: m.sport_id,
    scheduled_at: m.scheduled_at,
    status: m.status,
    location_name: m.location_name,
    location_tbd: m.location_tbd,
    message: m.message,
    proposed_by: m.proposed_by,
    final_score_a: m.final_score_a,
    final_score_b: m.final_score_b,
    side_a: a,
    side_b: b,
  };
}

export async function fetchOpponentCandidates(
  sportId: number,
  excludeTeamId: string,
): Promise<TeamLite[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, city, captain_id, is_active, sport_id')
    .eq('sport_id', sportId)
    .eq('is_active', true)
    .neq('id', excludeTeamId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('fetchOpponentCandidates error', error);
    return [];
  }
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    city: t.city,
    captain_id: t.captain_id,
  }));
}

export async function proposeMatch(input: {
  proposing_team_id: string;
  opponent_team_id: string;
  scheduled_at: string; // ISO with timezone
  location_name?: string;
  location_tbd?: boolean;
  message?: string;
}): Promise<{ ok: true; match_id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('propose_match', {
    p_proposing_team_id: input.proposing_team_id,
    p_opponent_team_id: input.opponent_team_id,
    p_scheduled_at: input.scheduled_at,
    p_location_name: input.location_name ?? null,
    p_location_tbd: input.location_tbd ?? false,
    p_message: input.message ?? null,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível propor o jogo.',
    };
  }
  return { ok: true, match_id: data as string };
}

export async function acceptMatch(
  matchId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('accept_match', {
    p_match_id: matchId,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível aceitar.',
    };
  }
  return { ok: true };
}

export async function rejectMatch(
  matchId: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('reject_match', {
    p_match_id: matchId,
    p_reason: reason ?? null,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível cancelar.',
    };
  }
  return { ok: true };
}

export function formatMatchDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} · ${hour}:${min}`;
}

export function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'proposed':
      return 'Proposto';
    case 'confirmed':
      return 'Confirmado';
    case 'result_pending':
      return 'Resultado pendente';
    case 'validated':
      return 'Validado';
    case 'disputed':
      return 'Em disputa';
    case 'cancelled':
      return 'Cancelado';
  }
}
