import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type Props = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  alignment?: 'left' | 'center';
};

const sizeMap: Record<NonNullable<Props['size']>, number> = {
  sm: 18,
  md: 26,
  lg: 36,
  xl: 48,
};

/**
 * Stylised wordmark. "Jogada" in white, "Limpa" in pitch green, with a
 * tight tracking and a green underline accent to evoke a football pitch
 * touch-line. Pure RN (no SVG / images), so it scales clean everywhere.
 */
export function Logo({ size = 'md', alignment = 'center' }: Props) {
  const fs = sizeMap[size];
  return (
    <View
      style={[
        styles.row,
        alignment === 'left' ? styles.alignLeft : styles.alignCenter,
      ]}
    >
      <View>
        <Text style={[styles.word, { fontSize: fs }]}>
          Jogada<Text style={styles.brand}> Limpa</Text>
        </Text>
        <View
          style={[
            styles.underline,
            {
              width: fs * 1.1,
              marginTop: Math.round(fs * 0.12),
            },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Single-letter mark — useful for splash, avatars or compact spots.
 * Renders a green-bordered circle with a stylised "JL".
 */
export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <View
      style={[
        markStyles.frame,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          borderWidth: Math.max(1.5, size * 0.04),
        },
      ]}
    >
      <Text style={[markStyles.text, { fontSize: size * 0.46 }]}>JL</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  alignLeft: { justifyContent: 'flex-start' },
  alignCenter: { justifyContent: 'center', alignSelf: 'center' },
  word: {
    color: colors.text,
    fontWeight: '900',
    letterSpacing: -1,
  },
  brand: { color: colors.brand },
  underline: {
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignSelf: 'flex-end',
  },
});

const markStyles = StyleSheet.create({
  frame: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.brand,
    fontWeight: '900',
    letterSpacing: -1,
  },
});
