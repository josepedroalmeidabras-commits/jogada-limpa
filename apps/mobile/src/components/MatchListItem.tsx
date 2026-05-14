import { StyleSheet, View } from 'react-native';
import type { MatchSummary } from '@/lib/matches';
import {
  MatchResultRow,
  type MatchResultStatus,
} from './MatchResultRow';
import { colors } from '@/theme';

type Props = {
  match: MatchSummary;
  onPress?: () => void;
  highlightTeamId?: string;
};

export function MatchListItem({ match, onPress, highlightTeamId }: Props) {
  // Prefer participant side (set by fetchMatchesForPlayer); fallback to team highlight
  let mySide: 'A' | 'B' | null = match.my_side ?? null;
  if (!mySide) {
    if (highlightTeamId === match.side_a.id) mySide = 'A';
    else if (highlightTeamId === match.side_b.id) mySide = 'B';
  }

  // Status badge override for live / imminent (confirmed) games
  let statusBadge: { label: string; color: string; bg: string } | null = null;
  if (match.status === 'confirmed') {
    const diff = new Date(match.scheduled_at).getTime() - Date.now();
    const mins = Math.floor(diff / 60_000);
    if (diff <= 0 && diff > -4 * 60 * 60 * 1000) {
      statusBadge = { label: 'AO VIVO', color: '#0E1812', bg: '#f87171' };
    } else if (mins >= 0 && mins < 60) {
      statusBadge = {
        label: `${mins || 1}MIN`,
        color: '#fbbf24',
        bg: 'rgba(251,191,36,0.14)',
      };
    } else if (mins >= 0 && mins < 120) {
      const h = Math.floor(mins / 60);
      statusBadge = {
        label: `${h}H`,
        color: '#fbbf24',
        bg: 'rgba(251,191,36,0.14)',
      };
    }
  }

  return (
    <MatchResultRow
      scheduledAt={match.scheduled_at}
      isInternal={match.is_internal}
      status={match.status as MatchResultStatus}
      sideAName={
        match.is_internal && match.side_a_label
          ? match.side_a_label
          : match.side_a.name
      }
      sideBName={
        match.is_internal && match.side_b_label
          ? match.side_b_label
          : match.side_b.name
      }
      sideAPhoto={match.side_a.photo_url}
      sideBPhoto={match.side_b.photo_url}
      scoreA={match.final_score_a}
      scoreB={match.final_score_b}
      mySide={mySide}
      myGoals={match.my_goals ?? 0}
      myAssists={match.my_assists ?? 0}
      statusBadge={statusBadge}
      onPress={onPress}
    />
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
});
