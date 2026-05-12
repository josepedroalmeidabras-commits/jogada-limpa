import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: 'default' | 'subtle' | 'warning' | 'success';
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

  if (!onPress) {
    return (
      <View style={[styles.base, variantStyles[variant], style]}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View style={[animStyle, style]}>
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
        style={[styles.base, variantStyles[variant]]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    padding: 16,
  },
});

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  subtle: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  warning: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  success: {
    backgroundColor: 'rgba(52,211,153,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
  },
});
