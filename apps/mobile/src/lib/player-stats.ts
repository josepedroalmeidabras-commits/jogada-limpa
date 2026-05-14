import { supabase } from './supabase';
import { colors } from '../theme';

export type StatCategory =
  | 'velocidade'
  | 'remate'
  | 'drible'
  | 'passe'
  | 'defesa'
  | 'fisico'
  // GK-specific
  | 'reflexos'
  | 'defesa_aerea'
  | 'posicionamento'
  | 'distribuicao'
  | 'saidas';

export const OUTFIELD_CATEGORIES: StatCategory[] = [
  'velocidade',
  'remate',
  'drible',
  'passe',
  'defesa',
  'fisico',
];

export const GK_CATEGORIES: StatCategory[] = [
  'reflexos',
  'defesa_aerea',
  'posicionamento',
  'distribuicao',
  'saidas',
  'fisico',
];

// Legacy export — defaults to outfield. Use categoriesForPosition() for
// position-aware listings.
export const STAT_CATEGORIES: StatCategory[] = OUTFIELD_CATEGORIES;

export function categoriesForPosition(
  position: string | null | undefined,
): StatCategory[] {
  return position === 'gr' ? GK_CATEGORIES : OUTFIELD_CATEGORIES;
}

export function isGoalkeeper(position: string | null | undefined): boolean {
  return position === 'gr';
}

export const STAT_LABELS: Record<StatCategory, string> = {
  velocidade: 'Velocidade',
  remate: 'Remate',
  drible: 'Drible',
  passe: 'Passe',
  defesa: 'Defesa',
  fisico: 'Físico',
  reflexos: 'Reflexos',
  defesa_aerea: 'Defesa aérea',
  posicionamento: 'Posicionamento',
  distribuicao: 'Distribuição',
  saidas: 'Saídas',
};

// FUT-style 3-letter codes
export const STAT_SHORT: Record<StatCategory, string> = {
  velocidade: 'VEL',
  remate: 'REM',
  drible: 'DRI',
  passe: 'PAS',
  defesa: 'DEF',
  fisico: 'FÍS',
  reflexos: 'REF',
  defesa_aerea: 'AÉR',
  posicionamento: 'POS',
  distribuicao: 'DIS',
  saidas: 'SAÍ',
};

export const STAT_ICONS: Record<StatCategory, string> = {
  velocidade: '⚡',
  remate: '🎯',
  drible: '✨',
  passe: '🎁',
  defesa: '🛡️',
  fisico: '💪',
  reflexos: '⚡',
  defesa_aerea: '🪂',
  posicionamento: '📐',
  distribuicao: '🎯',
  saidas: '🚀',
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

export function emptyStats(
  position?: string | null,
): AggregateStat[] {
  return categoriesForPosition(position).map((c) => ({
    category: c,
    value: 0,
    votes: 0,
  }));
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
  if (value >= 85) return colors.brand;
  if (value >= 70) return '#84cc16';
  if (value >= 55) return colors.warning;
  if (value >= 40) return '#fb923c';
  return colors.textDim;
}

export async function fetchPlayerStats(
  userId: string,
  position?: string | null,
): Promise<AggregateStat[]> {
  const { data, error } = await supabase
    .from('player_stats_aggregate')
    .select('category, value, votes')
    .eq('user_id', userId);

  if (error || !data) {
    console.error('fetchPlayerStats error', error);
    return emptyStats(position);
  }

  const map = new Map<string, { value: number; votes: number }>();
  for (const row of data as Array<{
    category: string;
    value: number;
    votes: number;
  }>) {
    map.set(row.category, { value: row.value, votes: row.votes });
  }

  return categoriesForPosition(position).map((cat) => {
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

// Categorias em que já votei este alvo na época corrente (depois de 0083).
export async function fetchMyVotesForThisSeason(
  targetId: string,
): Promise<Record<StatCategory, number | undefined>> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return {} as Record<StatCategory, number | undefined>;
  const currentSeason = String(new Date().getFullYear());
  const { data, error } = await supabase
    .from('player_stat_votes')
    .select('category, value, season')
    .eq('voter_id', me)
    .eq('target_id', targetId)
    .eq('season', currentSeason);
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

export type PendingTeammate = {
  user_id: string;
  name: string;
  photo_url: string | null;
};

// Amigos cujos atributos eu ainda não votei nesta época (1 vote/season after 0083)
export async function fetchPendingStatVoteFriends(
  limit = 6,
): Promise<PendingTeammate[]> {
  const { data, error } = await supabase.rpc('pending_stat_vote_friends', {
    p_limit: limit,
  });
  if (error || !data) return [];
  return (data as any[]).map((r) => ({
    user_id: r.user_id,
    name: r.name,
    photo_url: r.photo_url ?? null,
  }));
}

// Alias para compat — código antigo continua a chamar com o nome de "teammates"
// mas agora resolve para amigos. Remover quando todos os callers migrarem.
export const fetchPendingStatVoteTeammates = fetchPendingStatVoteFriends;

export async function hasVotedThisSeason(
  targetId: string,
  category: StatCategory,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_voted_this_season', {
    p_target_id: targetId,
    p_category: category,
  });
  if (error) return false;
  return Boolean(data);
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
