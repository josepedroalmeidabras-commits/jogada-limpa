import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export function SuspendedScreen({
  onSignOut,
  suspendedAt,
}: {
  onSignOut: () => void;
  suspendedAt: string | null;
}) {
  const dateText = suspendedAt
    ? new Date(suspendedAt).toLocaleDateString('pt-PT')
    : null;
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>⚠️</Text>
      </View>
      <Text style={styles.title}>Conta suspensa</Text>
      <Text style={styles.body}>
        A tua conta foi suspensa por terem sido recebidas denúncias em dois
        jogos diferentes.
        {dateText ? ` Suspensão em ${dateText}.` : ''}
      </Text>
      <Text style={styles.subbody}>
        Se achas que foi um engano, contacta-nos em{' '}
        <Text style={styles.email}>apelos@jogadalimpa.app</Text> com o teu
        nome de utilizador e descreve o sucedido.
      </Text>
      <View style={{ height: 32 }} />
      <Button label="Terminar sessão" onPress={onSignOut} full size="lg" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 32,
    paddingTop: 120,
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: { fontSize: 44 },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  subbody: {
    color: colors.textFaint,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  email: { color: colors.brand, fontWeight: '700' },
});
