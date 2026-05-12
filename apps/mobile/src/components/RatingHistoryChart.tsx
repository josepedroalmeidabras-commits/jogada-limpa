import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ratingAverage,
  ratingTierColor,
  type RatingHistoryEntry,
} from '@/lib/rating-history';
import { colors } from '@/theme';

type Props = {
  rows: RatingHistoryEntry[];
};

const CHART_HEIGHT = 130;
const MIN_BAR_HEIGHT = 6;
const BAR_GAP = 4;

export function RatingHistoryChart({ rows }: Props) {
  const router = useRouter();

  // Newest is first in DB result, but we want left = oldest, right = recent.
  const chronological = useMemo(() => [...rows].reverse(), [rows]);
  const avg = useMemo(() => ratingAverage(rows), [rows]);

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Ainda sem ratings suficientes para mostrar.
        </Text>
      </View>
    );
  }

  // bar height range: 1.0 → MIN_BAR_HEIGHT, 5.0 → full
  function barHeight(value: number): number {
    const clamped = Math.max(1, Math.min(5, value));
    const ratio = (clamped - 1) / 4;
    return Math.max(MIN_BAR_HEIGHT, Math.round(ratio * (CHART_HEIGHT - 8)));
  }

  // average baseline position from bottom (0..1)
  const avgRatio = Math.max(0, Math.min(1, (avg - 1) / 4));
  const avgBottom = avgRatio * (CHART_HEIGHT - 8) + 4;

  return (
    <View>
      <View style={styles.chart}>
        {/* Dashed average line */}
        <View style={[styles.avgLine, { bottom: avgBottom }]} />

        <View style={styles.barsRow}>
          {chronological.map((r, i) => {
            const h = barHeight(r.avg_rating);
            const color = ratingTierColor(r.avg_rating);
            return (
              <Pressable
                key={r.match_id}
                onPress={() => router.push(`/(app)/matches/${r.match_id}`)}
                style={[
                  styles.barCol,
                  i < chronological.length - 1 && { marginRight: BAR_GAP },
                ]}
              >
                <View
                  style={[
                    styles.bar,
                    { height: h, backgroundColor: color },
                  ]}
                />
                <Text style={[styles.barValue, { color }]}>
                  {r.avg_rating.toFixed(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          {`Média ${avg.toFixed(1)}/5 · ${rows.length} jogo${rows.length === 1 ? '' : 's'}`}
        </Text>
        <View style={styles.legendRow}>
          <Legend color="#22c55e" label="≥4.2" />
          <Legend color="#facc15" label="≥3.5" />
          <Legend color="#fb923c" label="≥2.8" />
          <Legend color="#f87171" label="<2.8" />
        </View>
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: colors.textDim, fontSize: 12 },
  chart: {
    height: CHART_HEIGHT,
    position: 'relative',
  },
  avgLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderStyle: 'dashed',
    borderTopWidth: 1,
    borderTopColor: 'rgba(34,197,94,0.5)',
    zIndex: 1,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    zIndex: 2,
  },
  barCol: {
    flex: 1,
    minWidth: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barValue: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  legendRow: { flexDirection: 'row', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: { color: colors.textDim, fontSize: 10 },
});
