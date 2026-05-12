import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MatchSummary } from '@/lib/matches';
import { colors } from '@/theme';

type Props = {
  match: MatchSummary;
  onPress?: () => void;
  highlightTeamId?: string; // optional: show "TU" badge for that side
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  if (sameYear) return `${day}/${month}`;
  return `${day}/${month}/${String(d.getFullYear()).slice(2)}`;
}

function weekdayShort(iso: string): string {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days[new Date(iso).getDay()] ?? '';
}

type Status = MatchSummary['status'];

function statusInfo(status: Status): {
  badge: string | null;
  color: string;
  background: string;
} {
  switch (status) {
    case 'validated':
      return {
        badge: 'FT',
        color: '#0a0a0a',
        background: '#22c55e',
      };
    case 'proposed':
      return {
        badge: 'PROP.',
        color: '#fbbf24',
        background: 'rgba(251,191,36,0.12)',
      };
    case 'confirmed':
      return {
        badge: null,
        color: colors.brand,
        background: 'transparent',
      };
    case 'result_pending':
      return {
        badge: 'PEND.',
        color: '#fb923c',
        background: 'rgba(251,146,60,0.14)',
      };
    case 'disputed':
      return {
        badge: 'DISP.',
        color: '#f87171',
        background: 'rgba(248,113,113,0.14)',
      };
    case 'cancelled':
      return {
        badge: 'CANC.',
        color: '#737373',
        background: 'rgba(115,115,115,0.18)',
      };
    default:
      return { badge: null, color: colors.textMuted, background: 'transparent' };
  }
}

export function MatchListItem({ match, onPress, highlightTeamId }: Props) {
  const isValidated =
    match.status === 'validated' &&
    match.final_score_a !== null &&
    match.final_score_b !== null;
  const isCancelled = match.status === 'cancelled';

  const scoreA = match.final_score_a;
  const scoreB = match.final_score_b;
  const winnerA = isValidated && (scoreA ?? 0) > (scoreB ?? 0);
  const winnerB = isValidated && (scoreB ?? 0) > (scoreA ?? 0);

  const status = statusInfo(match.status);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {/* Date column */}
      <View style={styles.dateCol}>
        <Text style={styles.dateMain}>{formatShortDate(match.scheduled_at)}</Text>
        <Text style={styles.dateSub}>
          {`${weekdayShort(match.scheduled_at)} · ${formatTime(match.scheduled_at)}`}
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Teams + scores */}
      <View style={styles.body}>
        <TeamLine
          name={match.side_a.name}
          score={scoreA}
          showScore={isValidated}
          winner={winnerA}
          loser={isValidated && !winnerA && !!winnerB}
          cancelled={isCancelled}
          isYou={!!highlightTeamId && match.side_a.id === highlightTeamId}
        />
        <TeamLine
          name={match.side_b.name}
          score={scoreB}
          showScore={isValidated}
          winner={winnerB}
          loser={isValidated && !winnerB && !!winnerA}
          cancelled={isCancelled}
          isYou={!!highlightTeamId && match.side_b.id === highlightTeamId}
        />
      </View>

      {/* Status badge */}
      <View style={styles.statusCol}>
        {status.badge && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: status.background },
            ]}
          >
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.badge}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function TeamLine({
  name,
  score,
  showScore,
  winner,
  loser,
  cancelled,
  isYou,
}: {
  name: string;
  score: number | null;
  showScore: boolean;
  winner: boolean;
  loser: boolean;
  cancelled: boolean;
  isYou: boolean;
}) {
  return (
    <View style={styles.teamRow}>
      <Text
        numberOfLines={1}
        style={[
          styles.teamName,
          loser && styles.teamLoser,
          cancelled && styles.cancelledText,
          winner && styles.teamWinner,
        ]}
      >
        {name}
        {isYou && <Text style={styles.youBadge}>{'  · TU'}</Text>}
      </Text>
      <Text
        style={[
          styles.score,
          loser && styles.teamLoser,
          cancelled && styles.cancelledText,
          winner && styles.teamWinner,
        ]}
      >
        {showScore && score !== null ? String(score) : '–'}
      </Text>
    </View>
  );
}

export function MatchListGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: 'rgba(255,255,255,0.025)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  dateCol: { width: 64, alignItems: 'flex-start' },
  dateMain: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  dateSub: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  body: { flex: 1, gap: 4 },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.15,
  },
  teamWinner: {
    color: colors.text,
    fontWeight: '800',
  },
  teamLoser: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  cancelledText: {
    color: colors.textDim,
    textDecorationLine: 'line-through',
  },
  youBadge: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  score: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
    minWidth: 22,
    textAlign: 'right',
  },
  statusCol: { width: 48, alignItems: 'flex-end' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
