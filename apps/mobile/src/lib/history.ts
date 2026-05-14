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
  is_internal: boolean;
  side_a_label: string | null;
  side_b_label: string | null;
};

export type DetailedMatchHistoryEntry = {
  match_id: string;
  scheduled_at: string;
  is_internal: boolean;
  side_a_name: string;
  side_b_name: string;
  side_a_photo: string | null;
  side_b_photo: string | null;
  final_score_a: number;
  final_score_b: number;
  my_side: 'A' | 'B';
  my_goals: number;
  my_assists: number;
  result: 'W' | 'D' | 'L';
  is_mvp: boolean;
};

export async function fetchDetailedMatchHistory(
  userId: string,
  limit = 30,
): Promise<DetailedMatchHistoryEntry[]> {
  const { data, error } = await supabase.rpc(
    'fetch_user_match_history_detailed',
    { p_user_id: userId, p_limit: limit },
  );
  if (error) {
    console.error('fetchDetailedMatchHistory error', error);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    match_id: r.match_id,
    scheduled_at: r.scheduled_at,
    is_internal: Boolean(r.is_internal),
    side_a_name: r.side_a_name,
    side_b_name: r.side_b_name,
    side_a_photo: r.side_a_photo,
    side_b_photo: r.side_b_photo,
    final_score_a: r.final_score_a,
    final_score_b: r.final_score_b,
    my_side: r.my_side as 'A' | 'B',
    my_goals: r.my_goals,
    my_assists: r.my_assists,
    result: r.result as 'W' | 'D' | 'L',
    is_mvp: Boolean(r.is_mvp),
  }));
}

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
    is_internal: boolean | null;
    side_a_label: string | null;
    side_b_label: string | null;
    sport: { name: string } | null;
    sides: RawSide[];
  } | null;
};

export type WinStreak = {
  current: number;
  best: number;
};

export type MonthlyStats = {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
};

export type PersonalRecords = {
  biggest_win: { margin: number; opponent: string; date: string } | null;
  biggest_loss: { margin: number; opponent: string; date: string } | null;
  longest_streak: number;
  most_in_month: { month: string; count: number } | null;
};

export function computePersonalRecords(
  history: MatchHistoryEntry[],
): PersonalRecords {
  if (history.length === 0) {
    return {
      biggest_win: null,
      biggest_loss: null,
      longest_streak: 0,
      most_in_month: null,
    };
  }

  let biggestWin: { margin: number; opponent: string; date: string } | null = null;
  let biggestLoss: { margin: number; opponent: string; date: string } | null = null;

  for (const h of history) {
    const myScore = h.my_side === 'A' ? h.final_score_a : h.final_score_b;
    const oppScore = h.my_side === 'A' ? h.final_score_b : h.final_score_a;
    const diff = myScore - oppScore;
    if (diff > 0) {
      if (!biggestWin || diff > biggestWin.margin) {
        biggestWin = {
          margin: diff,
          opponent: h.opponent_team_name,
          date: h.scheduled_at,
        };
      }
    } else if (diff < 0) {
      const lossMargin = -diff;
      if (!biggestLoss || lossMargin > biggestLoss.margin) {
        biggestLoss = {
          margin: lossMargin,
          opponent: h.opponent_team_name,
          date: h.scheduled_at,
        };
      }
    }
  }

  const streak = computeWinStreak(history);

  // matches per month
  const monthCounts = new Map<string, number>();
  for (const h of history) {
    const d = new Date(h.scheduled_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  let mostMonth: { month: string; count: number } | null = null;
  for (const [m, c] of monthCounts) {
    if (!mostMonth || c > mostMonth.count) {
      mostMonth = { month: m, count: c };
    }
  }

  return {
    biggest_win: biggestWin,
    biggest_loss: biggestLoss,
    longest_streak: streak.best,
    most_in_month: mostMonth,
  };
}

export function computeMonthlyStats(
  history: MatchHistoryEntry[],
  reference: Date = new Date(),
): MonthlyStats {
  const month = reference.getMonth();
  const year = reference.getFullYear();
  let matches = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let gf = 0;
  let ga = 0;
  for (const h of history) {
    const d = new Date(h.scheduled_at);
    if (d.getMonth() !== month || d.getFullYear() !== year) continue;
    matches += 1;
    if (h.result === 'win') wins += 1;
    else if (h.result === 'loss') losses += 1;
    else draws += 1;
    const myScore = h.my_side === 'A' ? h.final_score_a : h.final_score_b;
    const oppScore = h.my_side === 'A' ? h.final_score_b : h.final_score_a;
    gf += myScore;
    ga += oppScore;
  }
  return {
    matches,
    wins,
    draws,
    losses,
    goals_for: gf,
    goals_against: ga,
  };
}

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
         is_internal, side_a_label, side_b_label,
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
        is_internal: !!m.is_internal,
        side_a_label: m.side_a_label,
        side_b_label: m.side_b_label,
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
