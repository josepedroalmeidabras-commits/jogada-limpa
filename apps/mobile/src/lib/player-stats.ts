import { supabase } from './supabase';

export type StatCategory =
  | 'velocidade'
  | 'remate'
  | 'drible'
  | 'passe'
  | 'defesa'
  | 'fisico';

export const STAT_CATEGORIES: StatCategory[] = [
  'velocidade',
  'remate',
  'drible',
  'passe',
  'defesa',
  'fisico',
];

export const STAT_LABELS: Record<StatCategory, string> = {
  velocidade: 'Velocidade',
  remate: 'Remate',
  drible: 'Drible',
  passe: 'Passe',
  defesa: 'Defesa',
  fisico: 'Físico',
};

export const STAT_ICONS: Record<StatCategory, string> = {
  velocidade: '⚡',
  remate: '🎯',
  drible: '✨',
  passe: '🎁',
  defesa: '🛡️',
  fisico: '💪',
};

export type AggregateStat = {
  category: StatCategory;
  value: number; // 0-99 (0 = no votes yet)
  votes: number;
};

export type MyVote = {
  category: StatCategory;
  value: number;
};

export function emptyStats(): AggregateStat[] {
  return STAT_CATEGORIES.map((c) => ({ category: c, value: 0, votes: 0 }));
}

export function ratingLabel(value: number): string {
  if (value >= 90) return 'Elite';
  if (value >= 80) return 'Excelente';
  if (value >= 70) return 'Muito bom';
  if (value >= 60) return 'Bom';
  if (value >= 50) return 'Médio';
  if (value >= 35) return 'Casual';
  return '—';
}

export function ratingColor(value: number): string {
  if (value >= 85) return '#22c55e';
  if (value >= 70) return '#84cc16';
  if (value >= 55) return '#fbbf24';
  if (value >= 40) return '#fb923c';
  return '#737373';
}

export async function fetchPlayerStats(
  userId: string,
): Promise<AggregateStat[]> {
  const { data, error } = await supabase
    .from('player_stats_aggregate')
    .select('category, value, votes')
    .eq('user_id', userId);

  if (error || !data) {
    console.error('fetchPlayerStats error', error);
    return emptyStats();
  }

  const map = new Map<string, { value: number; votes: number }>();
  for (const row of data as Array<{
    category: string;
    value: number;
    votes: number;
  }>) {
    map.set(row.category, { value: row.value, votes: row.votes });
  }

  return STAT_CATEGORIES.map((cat) => {
    const v = map.get(cat);
    return {
      category: cat,
      value: v?.value ?? 0,
      votes: v?.votes ?? 0,
    };
  });
}

export async function fetchMyVotesFor(
  targetId: string,
): Promise<Record<StatCategory, number | undefined>> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return {} as Record<StatCategory, number | undefined>;
  const { data, error } = await supabase
    .from('player_stat_votes')
    .select('category, value')
    .eq('voter_id', me)
    .eq('target_id', targetId);
  if (error || !data) {
    return {} as Record<StatCategory, number | undefined>;
  }
  const result: Record<string, number | undefined> = {};
  for (const row of data as Array<{ category: string; value: number }>) {
    result[row.category] = row.value;
  }
  return result as Record<StatCategory, number | undefined>;
}

export async function setStatVote(
  targetId: string,
  category: StatCategory,
  value: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const v = Math.max(1, Math.min(99, Math.round(value)));
  const { error } = await supabase.rpc('set_my_stat_vote', {
    p_target_id: targetId,
    p_category: category,
    p_value: v,
  });
  if (error) {
    return {
      ok: false,
      message: error.message ?? 'Não foi possível guardar.',
    };
  }
  return { ok: true };
}

export async function canVoteOnPlayer(targetId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_vote_on_player', {
    p_target_id: targetId,
  });
  if (error) return false;
  return Boolean(data);
}

// Overall rating = average of the 6 stats (0-99). For card badges.
export function overallRating(stats: AggregateStat[]): number {
  const rated = stats.filter((s) => s.votes > 0);
  if (rated.length === 0) return 0;
  const sum = rated.reduce((acc, s) => acc + s.value, 0);
  return Math.round(sum / rated.length);
}

export function totalVotes(stats: AggregateStat[]): number {
  return stats.reduce((acc, s) => acc + s.votes, 0);
}
