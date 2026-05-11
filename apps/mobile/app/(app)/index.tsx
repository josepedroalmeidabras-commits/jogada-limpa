import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/auth';

export default function HomeScreen() {
  const { session, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Bem-vindo 👋</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        <Text style={styles.note}>
          Por enquanto é só isto. Em breve: o teu perfil, equipas e marcação de
          jogos.
        </Text>

        <Pressable style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  email: {
    color: '#a3a3a3',
    fontSize: 16,
    textAlign: 'center',
  },
  note: {
    color: '#737373',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
