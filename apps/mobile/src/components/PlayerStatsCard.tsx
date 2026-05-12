import { StyleSheet, Text, View } from 'react-native';
import {
  ratingColor,
  STAT_ICONS,
  STAT_LABELS,
  type AggregateStat,
} from '@/lib/player-stats';
import { Card } from './Card';
import { Eyebrow } from './Heading';
import { colors } from '@/theme';

type Props = {
  stats: AggregateStat[];
  overall: number;
  totalVotes: number;
};

export function PlayerStatsCard({ stats, overall, totalVotes }: Props) {
  const hasAny = totalVotes > 0;

  return (
    <View>
      <View style={styles.headerRow}>
        <Eyebrow>Atributos</Eyebrow>
        {hasAny && (
          <Text style={styles.votesLabel}>
            {`${totalVotes} voto${totalVotes === 1 ? '' : 's'}`}
          </Text>
        )}
      </View>

      <Card style={{ marginTop: 8 }}>
        {hasAny && (
          <View style={styles.overallRow}>
            <View
              style={[
                styles.overallBadge,
                { borderColor: ratingColor(overall) },
              ]}
            >
              <Text
                style={[
                  styles.overallValue,
                  { color: ratingColor(overall) },
                ]}
              >
                {overall}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.overallTitle}>Rating global</Text>
              <Text style={styles.overallHint}>
                Média ponderada dos atributos votados.
              </Text>
            </View>
          </View>
        )}

        {!hasAny && (
          <Text style={styles.empty}>
            Sem votos ainda. Pede aos teus colegas de equipa para avaliarem.
          </Text>
        )}

        <View style={styles.bars}>
          {stats.map((s) => (
            <StatBar key={s.category} stat={s} />
          ))}
        </View>
      </Card>
    </View>
  );
}

function StatBar({ stat }: { stat: AggregateStat }) {
  const pct = Math.max(0, Math.min(99, stat.value)) / 99;
  const fillColor = stat.votes > 0 ? ratingColor(stat.value) : '#3f3f3f';
  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>
          <Text style={styles.barIcon}>{STAT_ICONS[stat.category]}</Text>
          {`  ${STAT_LABELS[stat.category]}`}
        </Text>
        <Text
          style={[
            styles.barValue,
            stat.votes === 0 && { color: colors.textDim },
          ]}
        >
          {stat.votes === 0 ? '—' : String(stat.value)}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: fillColor },
          ]}
        />
      </View>
      {stat.votes > 0 && (
        <Text style={styles.barVotes}>
          {`${stat.votes} voto${stat.votes === 1 ? '' : 's'}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  votesLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  overallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  overallBadge: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overallValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  overallTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  overallHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  bars: { gap: 12 },
  barRow: { gap: 4 },
  barHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  barIcon: { fontSize: 14 },
  barValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  barVotes: {
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
