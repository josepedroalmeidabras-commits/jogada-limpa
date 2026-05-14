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
  photo_url: string | null;
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
  /** Side the user participated on (set by fetchMatchesForPlayer/User) */
  my_side?: 'A' | 'B' | null;
  /** Goals scored by the user in this match */
  my_goals?: number;
  /** Assists by the user in this match */
  my_assists?: number;
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
    team:teams!inner(id, name, city, captain_id, photo_url)
  )
`;

export type CityActivity = {
  match_id: string;
  scheduled_at: string;
  side_a_name: string;
  side_b_name: string;
  side_a_photo: string | null;
  side_b_photo: string | null;
  final_score_a: number;
  final_score_b: number;
  is_internal: boolean;
};

export async function fetchCityActivity(
  city: string,
  limit = 10,
): Promise<CityActivity[]> {
  const { data, error } = await supabase
    .from('matches')
    .select(
      `id, scheduled_at, final_score_a, final_score_b, is_internal,
       side_a_label, side_b_label,
       sides:match_sides!inner(
         side,
         team:teams!inner(name, city, photo_url)
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
      const isInternal = Boolean(m.is_internal);
      return {
        match_id: m.id,
        scheduled_at: m.scheduled_at,
        side_a_name: isInternal && m.side_a_label ? m.side_a_label : a.name,
        side_b_name: isInternal && m.side_b_label ? m.side_b_label : b.name,
        side_a_photo: a.photo_url ?? null,
        side_b_photo: b.photo_url ?? null,
        final_score_a: m.final_score_a,
        final_score_b: m.final_score_b,
        is_internal: isInternal,
      };
    })
    .filter((x): x is CityActivity => x !== null)
    .slice(0, limit);
}

/**
 * Matches where the user is a participant (was invited/attended).
 * Includes pending invites — covers all matches actually involving the player.
 */
export async function fetchMatchesForPlayer(
  userId: string,
): Promise<MatchSummary[]> {
  const { data: parts, error: partErr } = await supabase
    .from('match_participants')
    .select('match_id, side, goals, assists')
    .eq('user_id', userId);
  if (partErr || !parts || parts.length === 0) return [];

  type PartRow = { match_id: string; side: 'A' | 'B'; goals: number | null; assists: number | null };
  const myByMatch = new Map<string, { side: 'A' | 'B'; goals: number; assists: number }>();
  for (const p of parts as PartRow[]) {
    myByMatch.set(p.match_id, {
      side: p.side,
      goals: p.goals ?? 0,
      assists: p.assists ?? 0,
    });
  }
  const matchIds = Array.from(myByMatch.keys());

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
        my_side: myByMatch.get(m.id)?.side ?? null,
        my_goals: myByMatch.get(m.id)?.goals ?? 0,
        my_assists: myByMatch.get(m.id)?.assists ?? 0,
      };
    })
    .filter((m): m is MatchSummary => !!m);
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

  // Fetch user's own participation per match (if any) so we can show V/D/E + stats
  const { data: myParts } = await supabase
    .from('match_participants')
    .select('match_id, side, goals, assists')
    .eq('user_id', userId)
    .in('match_id', matchIds);
  type PartRow = { match_id: string; side: 'A' | 'B'; goals: number | null; assists: number | null };
  const myByMatch = new Map<string, { side: 'A' | 'B'; goals: number; assists: number }>();
  for (const p of (myParts ?? []) as PartRow[]) {
    myByMatch.set(p.match_id, {
      side: p.side,
      goals: p.goals ?? 0,
      assists: p.assists ?? 0,
    });
  }

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
      const mine = myByMatch.get(m.id);
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
        my_side: mine?.side ?? null,
        my_goals: mine?.goals ?? 0,
        my_assists: mine?.assists ?? 0,
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
    .select('id, name, city, captain_id, photo_url, is_active, sport_id')
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
    photo_url: t.photo_url ?? null,
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

export async function setMyMatchAvailability(
  matchId: string,
  available: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc('set_my_match_availability', {
    p_match_id: matchId,
    p_available: available,
  });
  if (error) return { ok: false, message: error.message };
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

// Returns the soonest upcoming match the user is on either side of that is
// already confirmed (no pending response needed) — used for the home highlight.
export async function fetchNextMatchForUser(
  userId: string,
): Promise<MatchSummary | null> {
  const { data: memberships } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId);
  if (!memberships || memberships.length === 0) return null;

  const teamIds = memberships.map((m) => m.team_id);
  const { data: sideRows } = await supabase
    .from('match_sides')
    .select('match_id')
    .in('team_id', teamIds);
  if (!sideRows || sideRows.length === 0) return null;
  const matchIds = Array.from(new Set(sideRows.map((r) => r.match_id)));

  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .in('id', matchIds)
    .eq('status', 'confirmed')
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const m = data[0]! as any;
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

export async function fetchPendingChallengesForUser(
  userId: string,
): Promise<PendingChallenge[]> {
  const { data, error } = await supabase
    .from('match_sides')
    .select(
      `side, captain_id,
       match:matches!inner(
         id, scheduled_at, status, location_name, location_tbd, proposed_by,
         sides:match_sides!inner(side, team:teams!inner(id, name, city, captain_id, photo_url))
       )`,
    )
    .eq('captain_id', userId);

  if (error || !data) {
    console.error('fetchPendingChallengesForUser error', error);
    return [];
  }

  return (data as any[])
    .filter((row) => {
      const m = row.match;
      if (!m || m.status !== 'proposed') return false;
      // Exclui matches que EU propus — só "convites" recebidos contam.
      if (m.proposed_by === userId) return false;
      return true;
    })
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
  // Após migration 0082: reviews individuais entre colegas deixaram de
  // existir no fluxo. Só capitão da side avalia a equipa adversária em
  // jogos AMIGÁVEIS (is_internal=false). Peladinhas internas não têm
  // team-review.
  const { data: caps, error } = await supabase
    .from('match_sides')
    .select(
      `match_id, side, team_id,
       match:matches!inner(id, scheduled_at, status, is_internal,
         sides:match_sides!inner(side, team:teams!inner(id, name))
       )`,
    )
    .eq('captain_id', userId);

  if (error || !caps) {
    console.error('fetchPendingReviewsForUser error', error);
    return [];
  }

  // Filtrar para jogos validados + não-internal
  const validated = (caps as any[]).filter(
    (c) => c.match?.status === 'validated' && c.match?.is_internal === false,
  );
  if (validated.length === 0) return [];

  // Reviews de equipa já submetidas por este capitão
  const matchIds = validated.map((c) => c.match_id);
  const { data: doneReviews } = await supabase
    .from('team_reviews')
    .select('match_id, reviewed_team_id')
    .in('match_id', matchIds)
    .eq('reviewer_id', userId);

  const doneByMatch = new Map<string, Set<string>>();
  for (const r of doneReviews ?? []) {
    const set = doneByMatch.get(r.match_id) ?? new Set();
    set.add(r.reviewed_team_id);
    doneByMatch.set(r.match_id, set);
  }

  return validated
    .map((c): PendingReview | null => {
      const m = c.match;
      const a = (m.sides as any[]).find((s) => s.side === 'A')?.team;
      const b = (m.sides as any[]).find((s) => s.side === 'B')?.team;
      if (!a || !b) return null;
      // Equipa adversária à minha (a que devo avaliar)
      const opponentTeamId = c.side === 'A' ? b.id : a.id;
      const done = doneByMatch.get(m.id) ?? new Set();
      if (done.has(opponentTeamId)) return null;
      return {
        match_id: m.id,
        scheduled_at: m.scheduled_at,
        side_a_name: a.name,
        side_b_name: b.name,
        others_to_review: 1,
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
