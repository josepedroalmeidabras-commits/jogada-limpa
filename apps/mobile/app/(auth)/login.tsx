import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Logo, LogoMark } from '@/components/Logo';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme';

type Mode = 'login' | 'signup' | 'forgot';

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

    if (!email.trim()) {
      setError('Preenche o email.');
      return;
    }
    if (mode !== 'forgot') {
      if (!password) {
        setError('Preenche a password.');
        return;
      }
      if (password.length < 8) {
        setError('A password tem de ter pelo menos 8 caracteres.');
        return;
      }
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
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: 'https://jogadalimpa.app/reset' },
        );
        if (error) throw error;
        setInfo(
          'Se este email tiver conta, recebes um link de recuperação em alguns minutos.',
        );
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
        <TouchableWithoutFeedback
          onPress={Keyboard.dismiss}
          accessible={false}
        >
        <View style={styles.container}>
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            style={styles.heroBlock}
          >
            <LogoMark size={160} />
            <View style={{ marginTop: -24 }}>
              <Logo size="xl" />
            </View>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Bem-vindo de volta'
                : mode === 'signup'
                  ? 'Cria a tua conta'
                  : 'Recuperar password'}
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
            {mode !== 'forgot' && (
              <TextInput
                placeholder="Password"
                placeholderTextColor="#5a5a5a"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!pending}
                style={styles.input}
              />
            )}

            {error && <Text style={styles.error}>{error}</Text>}
            {info && <Text style={styles.info}>{info}</Text>}

            <Button
              label={
                mode === 'login'
                  ? 'Entrar'
                  : mode === 'signup'
                    ? 'Criar conta'
                    : 'Enviar link de recuperação'
              }
              onPress={handleSubmit}
              loading={pending}
              size="lg"
              full
              haptic="medium"
            />

            {mode === 'login' && (
              <Pressable
                onPress={() => {
                  setMode('forgot');
                  setError(null);
                  setInfo(null);
                  setPassword('');
                }}
                disabled={pending}
                hitSlop={10}
              >
                <Text style={styles.forgotText}>
                  Esqueceste-te da password?
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                setMode(
                  mode === 'login'
                    ? 'signup'
                    : mode === 'signup'
                      ? 'login'
                      : 'login',
                );
                setError(null);
                setInfo(null);
              }}
              disabled={pending}
              hitSlop={10}
            >
              <Text style={styles.switchText}>
                {mode === 'login' ? (
                  <>
                    Ainda não tens conta?{' '}
                    <Text style={styles.switchAction}>Criar</Text>
                  </>
                ) : mode === 'signup' ? (
                  <>
                    Já tens conta?{' '}
                    <Text style={styles.switchAction}>Entrar</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.switchAction}>← Voltar ao login</Text>
                  </>
                )}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
        </TouchableWithoutFeedback>
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
  subtitle: {
    color: colors.textMuted,
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
    color: colors.textMuted,
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
  forgotText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
});
