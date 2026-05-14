import { type ReactNode } from 'react';
import {
  Keyboard,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

/**
 * Reusable dark Screen wrapper. Faz fade-in on mount + dismiss do teclado
 * ao tocar fora de qualquer TextInput (presses em Pressables/Buttons
 * filhos continuam a funcionar — TouchableWithoutFeedback só dispara em
 * áreas vazias).
 */
export function Screen({ children, edges }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <TouchableWithoutFeedback
        onPress={Keyboard.dismiss}
        accessible={false}
      >
        <Animated.View
          entering={FadeIn.duration(300).springify().damping(20)}
          style={styles.inner}
        >
          {children}
        </Animated.View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E1812' },
  inner: { flex: 1 },
});
