import { Image, StyleSheet, Text, View } from 'react-native';
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
 * S7VN wordmark — gold, premium, with the "7" centred in italic as the
 * keystone (futebol de 7).
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
          S<Text style={styles.seven}>7</Text>VN
        </Text>
        <View
          style={[
            styles.underline,
            {
              width: fs * 0.9,
              marginTop: Math.round(fs * 0.12),
            },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * Crest-style mark. If a PNG is bundled at `assets/logo-crest.png` it is
 * rendered as a clean image; otherwise we fall back to a gold-bordered
 * shield-rounded frame with a stylised "7".
 *
 * To use the real crest: drop the gold-on-green shield PNG at
 *   apps/mobile/assets/logo-crest.png
 * Expo's Metro bundler will pick it up automatically.
 */
let crestSource: number | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  crestSource = require('../../assets/logo-crest.png');
} catch {
  crestSource = null;
}

export function LogoMark({ size = 56 }: { size?: number }) {
  if (crestSource) {
    return (
      <Image
        source={crestSource}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View
      style={[
        markStyles.frame,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          borderWidth: Math.max(1.5, size * 0.045),
        },
      ]}
    >
      <Text style={[markStyles.text, { fontSize: size * 0.6 }]}>7</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  alignLeft: { justifyContent: 'flex-start' },
  alignCenter: { justifyContent: 'center', alignSelf: 'center' },
  word: {
    color: colors.brand,
    fontWeight: '900',
    letterSpacing: 4,
  },
  seven: {
    color: colors.brand,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  underline: {
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.brand,
    alignSelf: 'flex-end',
  },
});

const markStyles = StyleSheet.create({
  frame: {
    borderColor: colors.brand,
    backgroundColor: 'rgba(201,162,107,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.brand,
    fontWeight: '900',
    letterSpacing: -2,
    fontStyle: 'italic',
  },
});
