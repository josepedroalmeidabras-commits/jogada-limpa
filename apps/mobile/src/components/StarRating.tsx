import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';

type Props = {
  value: number; // 0..5, can be fractional for display
  onChange?: (n: number) => void;
  size?: number;
  showNumber?: boolean;
  disabled?: boolean;
};

/**
 * Star rating component — Uber Eats / Airbnb style.
 * Read-only when onChange is not provided.
 */
export function StarRating({
  value,
  onChange,
  size = 22,
  showNumber = false,
  disabled = false,
}: Props) {
  const interactive = !!onChange && !disabled;
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        const half = !filled && value >= i - 0.75;
        const iconName = filled ? 'star' : half ? 'star-half' : 'star-outline';
        const node = (
          <Ionicons
            key={i}
            name={iconName}
            size={size}
            color={value > 0 ? colors.goldDeep : colors.textDim}
          />
        );
        if (!interactive) return <View key={i}>{node}</View>;
        return (
          <Pressable
            key={i}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange?.(i);
            }}
            hitSlop={6}
            style={styles.starHit}
          >
            {node}
          </Pressable>
        );
      })}
      {showNumber && value > 0 && (
        <Text style={[styles.number, { fontSize: Math.max(13, size * 0.7) }]}>
          {value.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starHit: {
    paddingHorizontal: 2,
  },
  number: {
    color: colors.goldDeep,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginLeft: 8,
  },
});
