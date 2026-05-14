import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { colors } from '@/theme';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function weekdayShort(iso: string) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return days[new Date(iso).getDay()] ?? '';
}

export type MatchResultStatus =
  | 'validated'
  | 'proposed'
  | 'confirmed'
  | 'result_pending'
  | 'disputed'
  | 'cancelled';

export type MatchResultRowProps = {
  scheduledAt: string;
  isInternal: boolean;
  status?: MatchResultStatus;
  sideAName: string;
  sideBName: string;
  sideAPhoto: string | null;
  sideBPhoto: string | null;
  scoreA: number | null;
  scoreB: number | null;
  /** When set, highlights "my" team in bold and shows V/D/E chip */
  mySide?: 'A' | 'B' | null;
  /** Personal stats from the "my" perspective (goals, assists, MVP) */
  myGoals?: number;
  myAssists?: number;
  isMvp?: boolean;
  /** Top chip badge for status (FT, AO VIVO, EM 30MIN, etc) overrides default */
  statusBadge?: { label: string; color: string; bg: string } | null;
  onPress?: () => void;
};

export function MatchResultRow({
  scheduledAt,
  isInternal,
  status = 'validated',
  sideAName,
  sideBName,
  sideAPhoto,
  sideBPhoto,
  scoreA,
  scoreB,
  mySide = null,
  myGoals = 0,
  myAssists = 0,
  isMvp = false,
  statusBadge,
  onPress,
}: MatchResultRowProps) {
  const hasScore = scoreA !== null && scoreB !== null;
  const aWon = hasScore && scoreA! > scoreB!;
  const bWon = hasScore && scoreB! > scoreA!;
  const draw = hasScore && scoreA === scoreB;

  const aBold = mySide === 'A' || (!mySide && aWon);
  const bBold = mySide === 'B' || (!mySide && bWon);

  const railColor = isInternal ? colors.goldDeep : colors.compete;
  const chipBg = isInternal ? colors.brandSoft : colors.competeSoft;
  const chipBorder = isInternal ? colors.goldDim : colors.competeDim;
  const chipColor = isInternal ? colors.goldDeep : colors.compete;

  // Status badge: explicit override, or computed default
  let badge: { label: string; color: string; bg: string } | null = statusBadge ?? null;
  if (!badge) {
    if (status === 'validated' && hasScore) {
      badge = { label: 'FT', color: '#0E1812', bg: '#C9A26B' };
    } else if (status === 'cancelled') {
      badge = { label: 'CANC.', color: '#737373', bg: 'rgba(115,115,115,0.18)' };
    } else if (status === 'disputed') {
      badge = { label: 'DISP.', color: '#f87171', bg: 'rgba(248,113,113,0.14)' };
    } else if (status === 'result_pending') {
      badge = { label: 'PEND.', color: '#fb923c', bg: 'rgba(251,146,60,0.14)' };
    } else if (status === 'proposed') {
      badge = { label: 'PROP.', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
    }
  }

  // Result chip (V/D/E) when user is a participant of validated match
  let resultChip: { label: string; bg: string } | null = null;
  if (mySide && hasScore && status === 'validated') {
    if (draw) {
      resultChip = { label: 'E', bg: colors.warning };
    } else if ((mySide === 'A' && aWon) || (mySide === 'B' && bWon)) {
      resultChip = { label: 'V', bg: colors.success };
    } else {
      resultChip = { label: 'D', bg: colors.danger };
    }
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderLeftColor: railColor },
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.dateCol}>
        <Text style={styles.dateMain}>{formatDate(scheduledAt)}</Text>
        <Text style={styles.dateSub}>
          {status === 'validated'
            ? weekdayShort(scheduledAt)
            : `${weekdayShort(scheduledAt)} · ${formatTime(scheduledAt)}`}
        </Text>
        <View
          style={[styles.kindChip, { backgroundColor: chipBg, borderColor: chipBorder }]}
        >
          <Text style={[styles.kindChipText, { color: chipColor }]}>
            {isInternal ? 'PELADINHA' : 'AMIGÁVEL'}
          </Text>
        </View>
      </View>

      <View style={styles.teamsCol}>
        <View style={styles.teamLine}>
          <Avatar url={sideAPhoto} name={sideAName} size={20} />
          <Text
            style={[
              styles.teamName,
              aBold && styles.teamNameBold,
              hasScore && !aWon && !aBold && styles.teamNameDim,
            ]}
            numberOfLines={1}
          >
            {sideAName}
          </Text>
          <Text
            style={[
              styles.score,
              aBold && styles.scoreBold,
              hasScore && !aWon && !aBold && styles.scoreDim,
            ]}
          >
            {hasScore ? scoreA : '—'}
          </Text>
        </View>
        <View style={[styles.teamLine, { marginTop: 4 }]}>
          <Avatar url={sideBPhoto} name={sideBName} size={20} />
          <Text
            style={[
              styles.teamName,
              bBold && styles.teamNameBold,
              hasScore && !bWon && !bBold && styles.teamNameDim,
            ]}
            numberOfLines={1}
          >
            {sideBName}
          </Text>
          <Text
            style={[
              styles.score,
              bBold && styles.scoreBold,
              hasScore && !bWon && !bBold && styles.scoreDim,
            ]}
          >
            {hasScore ? scoreB : '—'}
          </Text>
        </View>
      </View>

      {(myGoals > 0 || myAssists > 0 || isMvp) && (
        <View style={styles.statsLine}>
          {myGoals > 0 && (
            <View style={styles.statBadge}>
              <Ionicons name="football" size={11} color={colors.warning} />
              <Text style={styles.statBadgeText}>{myGoals}</Text>
            </View>
          )}
          {myAssists > 0 && (
            <View style={styles.statBadge}>
              <Ionicons name="hand-right" size={11} color={colors.success} />
              <Text style={styles.statBadgeText}>{myAssists}</Text>
            </View>
          )}
          {isMvp && (
            <View style={[styles.statBadge, styles.statBadgeMvp]}>
              <Ionicons name="trophy" size={11} color={colors.goldDeep} />
            </View>
          )}
        </View>
      )}

      {resultChip ? (
        <View style={[styles.resultChip, { backgroundColor: resultChip.bg }]}>
          <Text style={styles.resultChipText}>{resultChip.label}</Text>
        </View>
      ) : badge ? (
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      ) : (
        <View style={styles.statusPlaceholder} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 4,
    borderLeftWidth: 3,
    gap: 10,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.03)' },
  dateCol: { width: 82, gap: 3 },
  dateMain: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  dateSub: {
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  kindChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 3,
  },
  kindChipText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  teamsCol: { flex: 1, minWidth: 0 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  teamNameBold: {
    color: colors.text,
    fontWeight: '800',
  },
  teamNameDim: {
    color: colors.textMuted,
  },
  score: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'right',
  },
  scoreBold: {
    color: colors.text,
    fontWeight: '900',
  },
  scoreDim: {
    color: colors.textMuted,
  },
  statsLine: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 3,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statBadgeMvp: {
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  statBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  resultChip: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultChipText: {
    color: '#0E1812',
    fontSize: 12,
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  statusPlaceholder: {
    width: 36,
  },
});
