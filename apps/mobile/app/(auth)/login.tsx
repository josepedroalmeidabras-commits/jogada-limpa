import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
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
        if (!data.session) {
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
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            style={styles.heroBlock}
          >
            <Logo size="xl" />
            <Text style={styles.eyebrow}>A CASA DO FUTEBOL DE 7</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Bem-vindo de volta'
                : 'Cria a tua conta'}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(100).duration(400).springify()}
            style={styles.form}
          >
            <TextInput
              placeholder="Email"
              placeholderTextColor="#5a5a5a"
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
              placeholder="Password"
              placeholderTextColor="#5a5a5a"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!pending}
              style={styles.input}
            />

            {error && <Text style={styles.error}>{error}</Text>}
            {info && <Text style={styles.info}>{info}</Text>}

            <Button
              label={mode === 'login' ? 'Entrar' : 'Criar conta'}
              onPress={handleSubmit}
              loading={pending}
              size="lg"
              full
              haptic="medium"
            />

            <Pressable
              onPress={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
                setInfo(null);
              }}
              disabled={pending}
              hitSlop={10}
            >
              <Text style={styles.switchText}>
                {mode === 'login'
                  ? 'Ainda não tens conta? '
                  : 'Já tens conta? '}
                <Text style={styles.switchAction}>
                  {mode === 'login' ? 'Criar' : 'Entrar'}
                </Text>
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  heroBlock: { alignItems: 'center', marginBottom: 32 },
  eyebrow: {
    color: '#C9A26B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 16,
  },
  subtitle: {
    color: '#a3a3a3',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: -0.2,
  },
  form: { gap: 12 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#ffffff',
    fontSize: 16,
    letterSpacing: -0.1,
  },
  switchText: {
    color: '#a3a3a3',
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
  switchAction: {
    color: '#ffffff',
    fontWeight: '600',
  },
  error: { color: '#f87171', textAlign: 'center', fontSize: 13, marginTop: 4 },
  info: { color: '#a7f3d0', textAlign: 'center', fontSize: 13, marginTop: 4 },
});
