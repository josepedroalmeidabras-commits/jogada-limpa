import { type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

/**
 * Reusable dark Screen wrapper com fade-in on mount.
 * (Keyboard dismiss-on-tap-outside fica nos ecrãs que precisam — para
 * não interferir com gestos de scroll noutros sítios.)
 */
export function Screen({ children, edges }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <Animated.View
        entering={FadeIn.duration(300).springify().damping(20)}
        style={styles.inner}
      >
        {children}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E1812' },
  inner: { flex: 1 },
});
