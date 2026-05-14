import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { gradients } from '@/theme';

type Variant = 'default' | 'subtle' | 'warning' | 'success' | 'hero';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: Variant;
  style?: any;
  haptic?: boolean;
};

export function Card({
  children,
  onPress,
  onLongPress,
  variant = 'default',
  style,
  haptic = true,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const inner = (
    <Inner variant={variant}>{children}</Inner>
  );

  if (!onPress) {
    return <View style={[heroOuter(variant), style]}>{inner}</View>;
  }

  return (
    <Animated.View style={[animStyle, heroOuter(variant), style]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 200 });
        }}
        onPress={async () => {
          if (haptic) {
            try {
              await Haptics.selectionAsync();
            } catch {}
          }
          onPress();
        }}
        onLongPress={onLongPress}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

function Inner({ variant, children }: { variant: Variant; children: ReactNode }) {
  if (variant === 'hero') {
    return (
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.base, styles.heroInner]}
      >
        {children}
      </LinearGradient>
    );
  }
  return <View style={[styles.base, variantStyles[variant]]}>{children}</View>;
}

function heroOuter(variant: Variant) {
  if (variant !== 'hero') return undefined;
  return {
    borderRadius: 20,
    shadowColor: '#C9A26B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  };
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    padding: 16,
  },
  heroInner: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(201,162,107,0.22)',
  },
});

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  subtle: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  warning: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.28)',
  },
  success: {
    backgroundColor: 'rgba(52,211,153,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.28)',
  },
});
