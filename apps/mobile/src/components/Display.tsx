import { Text, type TextStyle, type StyleProp } from 'react-native';
import { colors, typography } from '@/theme';

type Size = 1 | 2 | 3;

type Props = {
  children: React.ReactNode;
  size?: Size;
  tone?: 'default' | 'gold' | 'success' | 'danger' | 'warning';
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
};

export function Display({
  children,
  size = 2,
  tone = 'default',
  align,
  style,
}: Props) {
  const base = size === 1 ? typography.display1 : size === 2 ? typography.display2 : typography.display3;
  const color =
    tone === 'gold'
      ? colors.goldDeep
      : tone === 'success'
        ? colors.success
        : tone === 'danger'
          ? colors.danger
          : tone === 'warning'
            ? colors.warning
            : colors.text;
  return (
    <Text style={[base, { color, textAlign: align ?? 'left' }, style]}>
      {children}
    </Text>
  );
}
