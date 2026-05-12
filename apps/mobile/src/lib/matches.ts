import { supabase } from './supabase';
import { sendPushToUser } from './push';

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
  notes: string | null;
  proposed_by: string;
  final_score_a: number | null;
  final_score_b: number | null;
  is_internal: boolean;
  side_a_label: string | null;
  side_b_label: string | null;
  referee_id: string | null;
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
  message, notes, proposed_by, final_score_a, final_score_b,
  is_internal, side_a_label, side_b_label, referee_id,
  sides:match_sides!inner(
    side,
    team:teams!inner(id, name, city, captain_id)
  )
`;

export type CityActivity = {
  match_id: string;
  scheduled_at: string;
  side_a_name: string;
  side_b_name: string;
  final_score_a: number;
  final_score_b: number;
};

export async function fetchCityActivity(
  city: string,
  limit = 10,
): Promise<CityActivity[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      `id, scheduled_at, final_score_a, final_score_b,
       sides:match_sides!inner(
         side,
         team:teams!inner(name, city)
       )`,
    )
    .eq('status', 'validated')
    .order('scheduled_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return (data as any[])
    .map((m): CityActivity | null => {
      const a = (m.sides as any[]).find((s) => s.side === 'A')?.team;
      const b = (m.sides as any[]).find((s) => s.side === 'B')?.team;
      if (!a || !b) return null;
      if (a.city !== city && b.city !== city) return null;
      return {
        match_id: m.id,
        scheduled_at: m.scheduled_at,
        side_a_name: a.name,
        side_b_name: b.name,
        final_score_a: m.final_score_a,
        final_score_b: m.final_score_b,
      };
    })
    .filter((x): x is CityActivity => x !== null)
    .slice(0, limit);
}

export async function fetchMatchesForUser(
  userId: string,
): Promise<MatchSummary[]> {
  // teams I belong to
  const { data: memberships, error: memErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId);
  if (memErr || !memberships || memberships.length === 0) return [];

  const teamIds = memberships.map((m) => m.team_id);

  const { data: sideRows, error: sideErr } = await supabase
    .from('match_sides')
    .select('match_id')
    .in('team_id', teamIds);
  if (sideErr || !sideRows || sideRows.length === 0) return [];

  const matchIds = Array.from(new Set(sideRows.map((r) => r.match_id)));

  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .in('id', matchIds)
    .in('status', ['proposed', 'confirmed', 'result_pending', 'disputed', 'validated'])
    .order('scheduled_at', { ascending: true });

  if (error || !data) return [];

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
        notes: m.notes ?? null,
        is_internal: Boolean(m.is_internal),
        side_a_label: m.side_a_label ?? null,
        side_b_label: m.side_b_label ?? null,
        referee_id: m.referee_id ?? null,
        proposed_by: m.proposed_by,
        final_score_a: m.final_score_a,
        final_score_b: m.final_score_b,
        side_a: a,
        side_b: b,
      };
    })
    .filter((m): m is MatchSummary => !!m);
}

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
        notes: m.notes ?? null,
        is_internal: Boolean(m.is_internal),
        side_a_label: m.side_a_label ?? null,
        side_b_label: m.side_b_label ?? null,
        referee_id: m.referee_id ?? null,
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
    notes: m.notes ?? null,
    is_internal: Boolean(m.is_internal),
    side_a_label: m.side_a_label ?? null,
    side_b_label: m.side_b_label ?? null,
    referee_id: m.referee_id ?? null,
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
  notes?: string;
}): Promise<{ ok: true; match_id: string } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('propose_match', {
    p_proposing_team_id: input.proposing_team_id,
    p_opponent_team_id: input.opponent_team_id,
    p_scheduled_at: input.scheduled_at,
    p_location_name: input.location_name ?? null,
    p_location_tbd: input.location_tbd ?? false,
    p_message: input.message ?? null,
    p_notes: input.notes ?? null,
  });
  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? 'Não foi possível propor o jogo.',
    };
  }
  const matchId = data as string;

  // notify opponent captain
  void (async () => {
    const [{ data: opponentTeam }, { data: proposingTeam }] = await Promise.all(
      [
        supabase
          .from('teams')
          .select('captain_id, name')
          .eq('id', input.opponent_team_id)
          .maybeSingle(),
        supabase
          .from('teams')
          .select('name')
          .eq('id', input.proposing_team_id)
          .maybeSingle(),
      ],
    );
    if (opponentTeam?.captain_id) {
      await sendPushToUser(opponentTeam.captain_id, {
        title: 'Novo desafio',
        body: `${proposingTeam?.name ?? 'Uma equipa'} quer jogar contra ${opponentTeam.name ?? 'a tua equipa'}`,
        data: { match_id: matchId, type: 'match_proposed' },
      });
    }
  })();

  return { ok: true, match_id: matchId };
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

  // notify proposing captain (side A)
  void (async () => {
    const m = await fetchMatchById(matchId);
    if (m) {
      await sendPushToUser(m.side_a.captain_id, {
        title: 'Desafio aceite ✅',
        body: `${m.side_b.name} aceitou o teu desafio. Vai à app para combinar detalhes.`,
        data: { match_id: matchId, type: 'match_accepted' },
      });
    }
  })();

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

export async function updateMatchNotes(
  matchId: string,
  notes: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('update_match_notes', {
    p_match_id: matchId,
    p_notes: notes,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível guardar.',
    };
  }
  return { ok: true };
}

export async function isMatchParticipant(
  matchId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('match_sides')
    .select('team_id, team_members:team_members!inner(user_id)')
    .eq('match_id', matchId)
    .eq('team_members.user_id', userId)
    .limit(1);
  if (error || !data) return false;
  return data.length > 0;
}

export async function cancelConfirmedMatch(
  matchId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('cancel_confirmed_match', {
    p_match_id: matchId,
    p_reason: reason,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível cancelar.',
    };
  }
  return { ok: true };
}

export async function rescheduleMatch(
  matchId: string,
  scheduledAt: Date,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('reschedule_match', {
    p_match_id: matchId,
    p_scheduled_at: scheduledAt.toISOString(),
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível remarcar.',
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

export function formatRelativeMatchDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, now)) return `Hoje · ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(d, tomorrow)) return `Amanhã · ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Ontem · ${time}`;

  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const absDiff = Math.abs(d.getTime() - now.getTime());
  if (absDiff < oneWeek) {
    const weekday = d.toLocaleDateString('pt-PT', { weekday: 'long' });
    const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${cap} · ${time}`;
  }
  return formatMatchDate(iso);
}

export type PendingChallenge = {
  match_id: string;
  scheduled_at: string;
  location_name: string | null;
  location_tbd: boolean;
  my_side: 'A' | 'B';
  opponent_team_name: string;
  opponent_team_id: string;
};

export async function fetchPendingChallengesForUser(
  userId: string,
): Promise<PendingChallenge[]> {
  const { data, error } = await supabase
    .from('match_sides')
    .select(
      `side, captain_id,
       match:matches!inner(
         id, scheduled_at, status, location_name, location_tbd,
         sides:match_sides!inner(side, team:teams!inner(id, name, city, captain_id))
       )`,
    )
    .eq('captain_id', userId);

  if (error || !data) {
    console.error('fetchPendingChallengesForUser error', error);
    return [];
  }

  return (data as any[])
    .filter((row) => row.match?.status === 'proposed')
    .map((row): PendingChallenge | null => {
      const m = row.match;
      const mySide = row.side as 'A' | 'B';
      const opp = (m.sides as any[]).find((s) => s.side !== mySide)?.team;
      if (!opp) return null;
      return {
        match_id: m.id,
        scheduled_at: m.scheduled_at,
        location_name: m.location_name,
        location_tbd: m.location_tbd,
        my_side: mySide,
        opponent_team_name: opp.name,
        opponent_team_id: opp.id,
      };
    })
    .filter((p): p is PendingChallenge => p !== null);
}

export type PendingReview = {
  match_id: string;
  scheduled_at: string;
  side_a_name: string;
  side_b_name: string;
  others_to_review: number;
};

export async function fetchPendingReviewsForUser(
  userId: string,
): Promise<PendingReview[]> {
  // matches where I participated + validated
  const { data: parts, error } = await supabase
    .from('match_participants')
    .select(
      `match_id, side,
       match:matches!inner(
         id, scheduled_at, status,
         sides:match_sides!inner(side, team:teams!inner(id, name))
       )`,
    )
    .eq('user_id', userId)
    .in('attendance', ['attended', 'substitute_in']);

  if (error || !parts) {
    console.error('fetchPendingReviewsForUser error', error);
    return [];
  }

  const validated = (parts as any[]).filter(
    (p) => p.match?.status === 'validated',
  );
  if (validated.length === 0) return [];

  const matchIds = validated.map((p) => p.match_id);

  // count other participants per match
  const { data: allParts } = await supabase
    .from('match_participants')
    .select('match_id, user_id')
    .in('match_id', matchIds)
    .in('attendance', ['attended', 'substitute_in']);

  // count reviews I already submitted
  const { data: myReviews } = await supabase
    .from('reviews')
    .select('match_id, reviewed_id')
    .in('match_id', matchIds)
    .eq('reviewer_id', userId);

  const partsByMatch = new Map<string, Set<string>>();
  for (const p of allParts ?? []) {
    const set = partsByMatch.get(p.match_id) ?? new Set();
    set.add(p.user_id);
    partsByMatch.set(p.match_id, set);
  }
  const reviewedByMatch = new Map<string, Set<string>>();
  for (const r of myReviews ?? []) {
    const set = reviewedByMatch.get(r.match_id) ?? new Set();
    set.add(r.reviewed_id);
    reviewedByMatch.set(r.match_id, set);
  }

  return validated
    .map((p): PendingReview | null => {
      const m = p.match;
      const a = (m.sides as any[]).find((s) => s.side === 'A')?.team;
      const b = (m.sides as any[]).find((s) => s.side === 'B')?.team;
      if (!a || !b) return null;
      const allOthers = new Set(partsByMatch.get(m.id) ?? []);
      allOthers.delete(userId);
      const reviewed = reviewedByMatch.get(m.id) ?? new Set();
      const pending = [...allOthers].filter((id) => !reviewed.has(id));
      if (pending.length === 0) return null;
      return {
        match_id: m.id,
        scheduled_at: m.scheduled_at,
        side_a_name: a.name,
        side_b_name: b.name,
        others_to_review: pending.length,
      };
    })
    .filter((p): p is PendingReview => p !== null);
}

export type TeamEloStats = {
  team_id: string;
  elo_avg: number;
  member_count: number;
};

export async function fetchTeamEloStats(
  teamIds: string[],
): Promise<Record<string, TeamEloStats>> {
  if (teamIds.length === 0) return {};
  const { data, error } = await supabase
    .from('team_elo')
    .select('team_id, elo_avg, member_count')
    .in('team_id', teamIds);
  if (error || !data) return {};
  const result: Record<string, TeamEloStats> = {};
  for (const id of teamIds) {
    result[id] = { team_id: id, elo_avg: 1200, member_count: 0 };
  }
  for (const row of data as any[]) {
    result[row.team_id] = {
      team_id: row.team_id,
      elo_avg: Number(row.elo_avg),
      member_count: row.member_count,
    };
  }
  return result;
}

export function balanceLabel(diff: number): {
  label: string;
  color: 'neutral' | 'up' | 'down';
} {
  if (diff <= -150) return { label: 'mais fraco', color: 'down' };
  if (diff >= 150) return { label: 'mais forte', color: 'up' };
  return { label: 'equilibrado', color: 'neutral' };
}

export type FormResult = 'W' | 'D' | 'L';

export async function fetchTeamsRecentForm(
  teamIds: string[],
  limit = 5,
): Promise<Record<string, FormResult[]>> {
  if (teamIds.length === 0) return {};

  const { data: sideRows } = await supabase
    .from('match_sides')
    .select('match_id, team_id, side')
    .in('team_id', teamIds);
  if (!sideRows) return {};

  const matchIds = Array.from(new Set(sideRows.map((r) => r.match_id)));
  if (matchIds.length === 0) return {};

  const { data: matches } = await supabase
    .from('matches')
    .select('id, scheduled_at, final_score_a, final_score_b, status')
    .in('id', matchIds)
    .eq('status', 'validated')
    .order('scheduled_at', { ascending: false });
  if (!matches) return {};

  const matchMap = new Map(matches.map((m) => [m.id, m]));

  const byTeam: Record<string, FormResult[]> = {};
  for (const id of teamIds) byTeam[id] = [];

  for (const row of sideRows) {
    const m = matchMap.get(row.match_id);
    if (!m) continue;
    if (m.final_score_a === null || m.final_score_b === null) continue;
    const own = row.side === 'A' ? m.final_score_a : m.final_score_b;
    const opp = row.side === 'A' ? m.final_score_b : m.final_score_a;
    const r: FormResult = own > opp ? 'W' : own < opp ? 'L' : 'D';
    const arr = byTeam[row.team_id]!;
    if (arr.length < limit) arr.push(r);
  }
  return byTeam;
}

export type TeamRecord = {
  wins: number;
  losses: number;
  draws: number;
  goals_for: number;
  goals_against: number;
  played: number;
};

export function computeTeamRecord(
  matches: MatchSummary[],
  teamId: string,
): TeamRecord {
  const rec: TeamRecord = {
    wins: 0,
    losses: 0,
    draws: 0,
    goals_for: 0,
    goals_against: 0,
    played: 0,
  };
  for (const m of matches) {
    if (
      m.status !== 'validated' ||
      m.final_score_a === null ||
      m.final_score_b === null
    )
      continue;
    const isA = m.side_a.id === teamId;
    const isB = m.side_b.id === teamId;
    if (!isA && !isB) continue;
    const own = isA ? m.final_score_a : m.final_score_b;
    const opp = isA ? m.final_score_b : m.final_score_a;
    rec.played += 1;
    rec.goals_for += own;
    rec.goals_against += opp;
    if (own > opp) rec.wins += 1;
    else if (own < opp) rec.losses += 1;
    else rec.draws += 1;
  }
  return rec;
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
