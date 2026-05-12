import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { EloHistoryPoint } from '@/lib/elo-history';
import { colors } from '@/theme';

type Props = {
  points: EloHistoryPoint[];
};

const CHART_HEIGHT = 100;
const BAR_GAP = 3;
const MIN_BAR_HEIGHT = 4;

export function EloChart({ points }: Props) {
  const layout = useMemo(() => {
    if (points.length === 0) return null;
    const max = Math.max(...points.map((p) => Math.abs(p.delta)), 1);
    return { max };
  }, [points]);

  if (points.length === 0 || !layout) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Sem jogos validados ainda.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.chart}>
        {/* zero baseline */}
        <View style={styles.zeroLine} />

        <View style={styles.barsRow}>
          {points.map((p, i) => {
            const ratio = Math.abs(p.delta) / layout.max;
            const half = (CHART_HEIGHT - 2) / 2;
            const h = Math.max(MIN_BAR_HEIGHT, Math.round(ratio * half));
            const positive = p.delta >= 0;
            return (
              <View
                key={`${p.match_id}-${i}`}
                style={[
                  styles.barWrap,
                  i < points.length - 1 && { marginRight: BAR_GAP },
                ]}
              >
                <View style={styles.barTop}>
                  {positive && (
                    <View
                      style={[
                        styles.bar,
                        {
                          height: h,
                          backgroundColor: '#34d399',
                          borderTopLeftRadius: 2,
                          borderTopRightRadius: 2,
                        },
                      ]}
                    />
                  )}
                </View>
                <View style={styles.barBottom}>
                  {!positive && (
                    <View
                      style={[
                        styles.bar,
                        {
                          height: h,
                          backgroundColor: '#f87171',
                          borderBottomLeftRadius: 2,
                          borderBottomRightRadius: 2,
                        },
                      ]}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legend}>Mais antigo</Text>
        <Text style={styles.legend}>Recente</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: colors.textDim, fontSize: 12 },
  chart: {
    height: CHART_HEIGHT,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  zeroLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CHART_HEIGHT / 2 - 0.5,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flex: 1,
    height: '100%',
  },
  barWrap: {
    flex: 1,
    minWidth: 4,
    flexDirection: 'column',
  },
  barTop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  barBottom: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  bar: {
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  legend: {
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
