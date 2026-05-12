import type { MatchHistoryEntry } from './history';

export type Achievement = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
};

type Input = {
  history: MatchHistoryEntry[];
  mvpCount: number;
  isCaptain: boolean;
  currentStreak: number;
  bestStreak: number;
  cityRanking?: number | null; // 1-based position in city
};

export function computeAchievements({
  history,
  mvpCount,
  isCaptain,
  currentStreak,
  bestStreak,
  cityRanking,
}: Input): Achievement[] {
  const played = history.length;
  const wins = history.filter((h) => h.result === 'win').length;

  const defs: Omit<Achievement, 'unlocked'>[] = [
    {
      id: 'first_match',
      emoji: '⚽',
      title: 'Primeiro jogo',
      description: 'Joga o teu primeiro jogo validado.',
    },
    {
      id: 'first_win',
      emoji: '🥇',
      title: 'Primeira vitória',
      description: 'Vence um jogo.',
    },
    {
      id: 'veteran',
      emoji: '🎖️',
      title: 'Veterano',
      description: '10 jogos validados.',
    },
    {
      id: 'centurion',
      emoji: '💯',
      title: 'Centurião',
      description: '100 jogos validados.',
    },
    {
      id: 'streak_3',
      emoji: '🔥',
      title: 'A pegar fogo',
      description: '3 vitórias seguidas.',
    },
    {
      id: 'streak_5',
      emoji: '🌋',
      title: 'Imparável',
      description: '5 vitórias seguidas.',
    },
    {
      id: 'mvp_1',
      emoji: '👑',
      title: 'MVP',
      description: 'Votado MVP num jogo.',
    },
    {
      id: 'mvp_10',
      emoji: '🏆',
      title: 'Lenda',
      description: '10 votos de MVP.',
    },
    {
      id: 'captain',
      emoji: '🎯',
      title: 'Capitão',
      description: 'Cria a tua equipa.',
    },
    {
      id: 'top10_city',
      emoji: '🥈',
      title: 'Top 10 da cidade',
      description: 'Entra no top 10 do ranking da tua cidade.',
    },
  ];

  const unlocked: Record<string, boolean> = {
    first_match: played >= 1,
    first_win: wins >= 1,
    veteran: played >= 10,
    centurion: played >= 100,
    streak_3: bestStreak >= 3 || currentStreak >= 3,
    streak_5: bestStreak >= 5 || currentStreak >= 5,
    mvp_1: mvpCount >= 1,
    mvp_10: mvpCount >= 10,
    captain: isCaptain,
    top10_city: cityRanking !== null && cityRanking !== undefined && cityRanking <= 10,
  };

  return defs.map((d) => ({ ...d, unlocked: unlocked[d.id] ?? false }));
}
