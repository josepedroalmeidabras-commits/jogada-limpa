import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  iconLeft?: ReactNode;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  full,
  haptic = 'light',
  iconLeft,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(0.85, { duration: 120 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    opacity.value = withTiming(1, { duration: 200 });
  };

  const handlePress = async () => {
    if (disabled || loading) return;
    if (haptic !== 'none') {
      const map: Record<'light' | 'medium' | 'heavy', Haptics.ImpactFeedbackStyle> = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      try {
        await Haptics.impactAsync(map[haptic]);
      } catch {
        // ignore on unsupported platforms
      }
    }
    await onPress?.();
  };

  const inactive = disabled || loading;

  return (
    <Animated.View style={[full && { width: '100%' }, animStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={inactive}
        style={[
          styles.base,
          sizeStyles[size],
          variantStyles[variant],
          full && styles.full,
          inactive && styles.inactive,
        ]}
        {...rest}
      >
        <View style={styles.row}>
          {loading ? (
            <ActivityIndicator
              color={
                variant === 'primary'
                  ? '#000000'
                  : variant === 'danger'
                    ? '#f87171'
                    : '#ffffff'
              }
            />
          ) : (
            <>
              {iconLeft}
              <Text
                style={[
                  textVariantStyles[variant],
                  textSizeStyles[size],
                  inactive && styles.textInactive,
                ]}
              >
                {label}
              </Text>
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  full: { width: '100%' },
  inactive: { opacity: 0.5 },
  textInactive: {},
});

const sizeStyles = StyleSheet.create({
  sm: { paddingHorizontal: 14, paddingVertical: 8 },
  md: { paddingHorizontal: 20, paddingVertical: 12 },
  lg: { paddingHorizontal: 28, paddingVertical: 16 },
});

const textSizeStyles = StyleSheet.create({
  sm: { fontSize: 13, fontWeight: '600', letterSpacing: -0.1 },
  md: { fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  lg: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: '#ffffff',
  },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  danger: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

const textVariantStyles = StyleSheet.create({
  primary: { color: '#000000' },
  secondary: { color: '#ffffff' },
  danger: { color: '#f87171' },
  ghost: { color: '#a3a3a3' },
});
