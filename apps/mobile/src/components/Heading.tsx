import { StyleSheet, Text, type TextStyle } from 'react-native';

type Props = {
  children: string;
  level?: 1 | 2 | 3;
  color?: string;
  style?: TextStyle;
};

export function Heading({ children, level = 1, color, style }: Props) {
  return (
    <Text
      style={[
        levelStyles[`h${level}`],
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

type EyebrowProps = {
  children: string;
  style?: TextStyle;
};

export function Eyebrow({ children, style }: EyebrowProps) {
  // iOS RN corrompe caracteres acentuados com `textTransform: uppercase`,
  // então uppercase em JS (Unicode correcto) e sem CSS transform.
  return (
    <Text style={[eyebrowStyle, style]}>
      {typeof children === 'string'
        ? children.toLocaleUpperCase('pt-PT')
        : children}
    </Text>
  );
}

const levelStyles = StyleSheet.create({
  h1: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  h2: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  h3: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 24,
  },
});

const eyebrowStyle: TextStyle = {
  color: '#737373',
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 1.5,
};
