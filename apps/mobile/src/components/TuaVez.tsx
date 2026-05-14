import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedNumber } from './AnimatedNumber';
import { colors } from '@/theme';

export type TuaVezItem = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: [string, string];
  iconBorder?: string;
  label: string;
  meta?: string;
  onPress: () => void;
};

type Props = {
  items: TuaVezItem[];
};

export function TuaVez({ items }: Props) {
  if (items.length === 0) return null;

  const total = items.length;
  const subtitle =
    total === 1 ? '1 coisa para tratar' : `${total} coisas para tratar`;

  return (
    <Animated.View entering={FadeInDown.duration(280).springify()}>
      <LinearGradient
        colors={['rgba(201,162,107,0.12)', 'rgba(201,162,107,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.eyebrow}>A TUA VEZ</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <View style={styles.totalBadge}>
            <AnimatedNumber
              value={total}
              duration={280}
              style={styles.totalBadgeText}
            />
          </View>
        </View>

        <View style={{ marginTop: 14, gap: 8 }}>
          {items.map((item, i) => (
            <Animated.View
              key={item.key}
              entering={FadeInDown.delay(60 + i * 40).springify()}
            >
              <Pressable
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <LinearGradient
                  colors={
                    item.iconBg ?? [
                      'rgba(201,162,107,0.22)',
                      'rgba(201,162,107,0.04)',
                    ]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.iconRing,
                    {
                      borderColor: item.iconBorder ?? colors.brandSoftBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.iconColor ?? colors.brand}
                  />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{item.label}</Text>
                  {item.meta ? (
                    <Text style={styles.meta}>{item.meta}</Text>
                  ) : null}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textDim}
                />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.goldDim,
    shadowColor: '#C9A26B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  subtitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  totalBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBadgeText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ scale: 0.99 }],
  },
  iconRing: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
});
