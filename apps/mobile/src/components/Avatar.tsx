import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  name?: string | null;
  url?: string | null;
  size?: number;
};

export function Avatar({ name, url, size = 40 }: Props) {
  const radius = size / 2;
  const fontSize = Math.max(12, Math.floor(size * 0.4));
  const initial = (name ?? '?').trim().slice(0, 1).toUpperCase();

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#ffffff', fontWeight: '700' },
});
