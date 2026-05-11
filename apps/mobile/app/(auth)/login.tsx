import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type Mode = 'login' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Preenche email e password.');
      return;
    }
    if (password.length < 8) {
      setError('A password tem de ter pelo menos 8 caracteres.');
      return;
    }

    setPending(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        if (data.session) {
          // confirmation off → já tens sessão
        } else {
          setInfo(
            'Conta criada. Verifica o email para confirmar antes de entrar.',
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido.';
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Jogada Limpa</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Text>

          <TextInput
            placeholder="Email"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={!pending}
            style={styles.input}
          />
          <TextInput
            placeholder="Password (8+ chars)"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!pending}
            style={styles.input}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {info && <Text style={styles.info}>{info}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={pending}
            style={[styles.button, pending && styles.buttonDisabled]}
          >
            {pending ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Entrar' : 'Criar conta'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setInfo(null);
            }}
            disabled={pending}
          >
            <Text style={styles.switchText}>
              {mode === 'login'
                ? 'Ainda não tens conta? Criar conta'
                : 'Já tens conta? Entrar'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#a3a3a3',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  switchText: {
    color: '#a3a3a3',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 14,
  },
  error: { color: '#f87171', textAlign: 'center', fontSize: 13 },
  info: { color: '#a7f3d0', textAlign: 'center', fontSize: 13 },
});
