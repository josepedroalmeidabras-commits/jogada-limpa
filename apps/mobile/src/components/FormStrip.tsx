import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export type FormResult = 'win' | 'draw' | 'loss';

type Props = {
  results: FormResult[];     // ordered oldest → newest, or any order
  reverse?: boolean;          // if true, render right-to-left
  size?: 'sm' | 'md';
};

const SIZES = {
  sm: { box: 18, font: 10, gap: 3 },
  md: { box: 22, font: 11, gap: 4 },
};

function letter(r: FormResult) {
  return r === 'win' ? 'V' : r === 'loss' ? 'D' : 'E';
}

function bg(r: FormResult) {
  return r === 'win'
    ? '#C9A26B'
    : r === 'loss'
      ? '#f87171'
      : '#a3a3a3';
}

export function FormStrip({ results, reverse = false, size = 'md' }: Props) {
  if (results.length === 0) {
    return (
      <View>
        <Text style={styles.empty}>Sem jogos validados.</Text>
      </View>
    );
  }
  const list = reverse ? [...results].reverse() : results;
  const s = SIZES[size];
  return (
    <View style={[styles.row, { gap: s.gap }]}>
      {list.map((r, i) => (
        <View
          key={i}
          style={[
            styles.box,
            {
              width: s.box,
              height: s.box,
              backgroundColor: bg(r),
            },
          ]}
        >
          <Text style={[styles.boxText, { fontSize: s.font }]}>{letter(r)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  box: {
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: { color: '#0E1812', fontWeight: '900' },
  empty: { color: colors.textDim, fontSize: 12 },
});
