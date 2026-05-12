import { supabase } from './supabase';

export type MatchHistoryEntry = {
  match_id: string;
  scheduled_at: string;
  sport_name: string;
  my_team_name: string;
  opponent_team_name: string;
  final_score_a: number;
  final_score_b: number;
  my_side: 'A' | 'B';
  result: 'win' | 'loss' | 'draw';
};

type RawSide = {
  side: 'A' | 'B';
  team: { id: string; name: string } | null;
};

type RawHistoryRow = {
  side: 'A' | 'B';
  match: {
    id: string;
    scheduled_at: string;
    final_score_a: number | null;
    final_score_b: number | null;
    status: string;
    sport: { name: string } | null;
    sides: RawSide[];
  } | null;
};

export type WinStreak = {
  current: number;
  best: number;
};

export function computeWinStreak(history: MatchHistoryEntry[]): WinStreak {
  // history is sorted desc by date (most recent first)
  let current = 0;
  let best = 0;
  let running = 0;
  // current: count consecutive wins from most recent backwards
  for (let i = 0; i < history.length; i += 1) {
    if (history[i]!.result === 'win') {
      if (i === current) current += 1;
    } else if (i === current) {
      break;
    }
  }
  // best: walk through, track max win run
  for (const h of history) {
    if (h.result === 'win') {
      running += 1;
      if (running > best) best = running;
    } else {
      running = 0;
    }
  }
  return { current, best };
}

export async function fetchUserMatchHistory(
  userId: string,
  limit = 10,
): Promise<MatchHistoryEntry[]> {
  const { data, error } = await supabase
    .from('match_participants')
    .select(
      `side,
       match:matches!inner(
         id, scheduled_at, final_score_a, final_score_b, status,
         sport:sports!inner(name),
         sides:match_sides!inner(
           side,
           team:teams!inner(id, name)
         )
       )`,
    )
    .eq('user_id', userId)
    .in('attendance', ['attended', 'substitute_in']);

  if (error || !data) {
    console.error('fetchUserMatchHistory error', error);
    return [];
  }

  const rows = (data as unknown as RawHistoryRow[])
    .filter((r): r is RawHistoryRow & { match: NonNullable<RawHistoryRow['match']> } =>
      r.match !== null && r.match.status === 'validated' &&
      r.match.final_score_a !== null && r.match.final_score_b !== null,
    )
    .map((r) => {
      const m = r.match;
      const mySideTeam = m.sides.find((s) => s.side === r.side)?.team;
      const oppSideTeam = m.sides.find((s) => s.side !== r.side)?.team;
      if (!mySideTeam || !oppSideTeam) return null;
      const myScore = r.side === 'A' ? m.final_score_a! : m.final_score_b!;
      const oppScore = r.side === 'A' ? m.final_score_b! : m.final_score_a!;
      const result: MatchHistoryEntry['result'] =
        myScore > oppScore ? 'win' : myScore < oppScore ? 'loss' : 'draw';
      return {
        match_id: m.id,
        scheduled_at: m.scheduled_at,
        sport_name: m.sport?.name ?? '',
        my_team_name: mySideTeam.name,
        opponent_team_name: oppSideTeam.name,
        final_score_a: m.final_score_a!,
        final_score_b: m.final_score_b!,
        my_side: r.side,
        result,
      } satisfies MatchHistoryEntry;
    })
    .filter((e): e is MatchHistoryEntry => e !== null);

  return rows
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() -
        new Date(a.scheduled_at).getTime(),
    )
    .slice(0, limit);
}
