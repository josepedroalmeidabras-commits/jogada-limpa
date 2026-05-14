import { useEffect } from 'react';
import { TextInput, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

// Permite mudar `text` por animatedProps — pattern conhecido do RN
// porque <Text> não aceita updates de props animados directamente.
Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Props = {
  value: number;
  style?: TextStyle | (TextStyle | undefined)[];
  duration?: number;
  delay?: number;
  /** Curva ease-out strong (Emil Kowalski recomendado) */
  easing?: ReturnType<typeof Easing.bezier>;
  format?: (n: number) => string;
};

export function AnimatedNumber({
  value,
  style,
  duration = 500,
  delay = 0,
  easing = Easing.bezier(0.23, 1, 0.32, 1),
  format = (n) => String(n),
}: Props) {
  const sv = useSharedValue(0);

  useEffect(() => {
    sv.value = withDelay(
      delay,
      withTiming(value, { duration, easing }),
    );
  }, [value, delay, duration, easing, sv]);

  const animatedProps = useAnimatedProps(() => {
    const rounded = Math.round(sv.value);
    return {
      text: format(rounded),
      defaultValue: format(rounded),
    } as Partial<{ text: string; defaultValue: string }>;
  });

  return (
    <AnimatedTextInput
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      animatedProps={animatedProps as any}
      editable={false}
      caretHidden
      selectTextOnFocus={false}
      style={[
        {
          padding: 0,
          margin: 0,
          // garante que o TextInput vai render como Text-look (alguns Androids
          // metem padding interno por default).
          textAlignVertical: 'center',
          includeFontPadding: false,
        },
        style,
      ]}
    />
  );
}
