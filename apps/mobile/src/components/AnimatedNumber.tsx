import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

type Props = {
  value: number;
  style?: TextStyle | (TextStyle | undefined)[];
  duration?: number;
  delay?: number;
  format?: (n: number) => string;
};

// Cubic ease-out (Emil Kowalski's strong curve): 1 - (1-t)^3.
// Aproxima cubic-bezier(0.23, 1, 0.32, 1) sem precisar de matemática de Bezier.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Count-up animado de 0 → value usando requestAnimationFrame.
 * JS-only, sem reanimated/TextInput tricks — robusto em Reanimated 4 +
 * New Architecture. Apenas re-renderiza o componente próprio (cheap).
 */
export function AnimatedNumber({
  value,
  style,
  duration = 500,
  delay = 0,
  format = (n) => String(n),
}: Props) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const startAfter = setTimeout(() => {
      const start = performance.now();
      const from = 0;
      const tick = () => {
        if (cancelled) return;
        const now = performance.now();
        const t = Math.min(1, (now - start) / Math.max(1, duration));
        const eased = easeOutCubic(t);
        setDisplayed(Math.round(from + (value - from) * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      tick();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(startAfter);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration, delay]);

  return <Text style={style}>{format(displayed)}</Text>;
}
