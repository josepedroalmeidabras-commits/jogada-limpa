import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>⚙️</Text>
      </View>
      <Text style={styles.title}>Erro de configuração</Text>
      <Text style={styles.body}>{message}</Text>
      <Text style={styles.subbody}>
        Esta versão da app foi distribuída sem as variáveis de ambiente
        necessárias. Contacta o suporte em{' '}
        <Text style={styles.email}>josepedroalmeidabras@gmail.com</Text>.
      </Text>
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
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
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
