import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
};

export function ErrorState({
  title = 'Algo falhou',
  message = 'Verifica a tua ligação e tenta outra vez.',
  onRetry,
  retryLabel = 'Tentar outra vez',
  compact = false,
}: Props) {
  function handleRetry() {
    if (!onRetry) return;
    void Haptics.selectionAsync();
    onRetry();
  }

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[styles.wrap, compact && styles.wrapCompact]}
    >
      <View style={[styles.iconRing, compact && styles.iconRingCompact]}>
        <Ionicons
          name="cloud-offline"
          size={compact ? 18 : 22}
          color={colors.danger}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.title, compact && styles.titleCompact]}>
          {title}
        </Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {onRetry ? (
        <Pressable
          onPress={handleRetry}
          style={({ pressed }) => [
            styles.retry,
            pressed && styles.retryPressed,
          ]}
          hitSlop={8}
        >
          <LinearGradient
            colors={['rgba(201,162,107,0.22)', 'rgba(201,162,107,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.retryInner}
          >
            <Ionicons name="refresh" size={14} color={colors.brand} />
            <Text style={styles.retryText}>{retryLabel}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.dangerSoftBorder,
    backgroundColor: colors.dangerSoft,
  },
  wrapCompact: {
    padding: 12,
    gap: 10,
    borderRadius: 14,
  },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.dangerSoftBorder,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  iconRingCompact: {
    width: 32,
    height: 32,
    borderRadius: 11,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  titleCompact: {
    fontSize: 14,
  },
  message: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  retry: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  retryPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  retryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  retryText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
