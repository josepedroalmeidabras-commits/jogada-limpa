import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { joinTeamByCode } from '@/lib/teams';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export default function JoinTeamScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(codeParam?.toUpperCase() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (codeParam) setCode(codeParam.toUpperCase());
  }, [codeParam]);

  async function handleSubmit() {
    setError(null);
    if (!session) {
      setError('Sessão inválida.');
      return;
    }
    if (!code.trim()) {
      setError('Mete o código que recebeste.');
      return;
    }
    setSubmitting(true);
    const result = await joinTeamByCode(session.user.id, code);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(`/(app)/teams/${result.team.id}`);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Entrar com código',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            style={{ alignItems: 'center' }}
          >
            <Eyebrow>Convite</Eyebrow>
            <Heading level={1} style={{ marginTop: 6, textAlign: 'center' }}>
              Tens um código?
            </Heading>
            <Text style={styles.subtitle}>
              Cola o código de 8 caracteres que o capitão te passou.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).springify()}>
            <TextInput
              style={styles.input}
              placeholder="3f2a8b1c"
              placeholderTextColor={colors.textFaint}
              value={code}
              onChangeText={(v) => setCode(v.trim().toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={8}
              editable={!submitting}
            />
          </Animated.View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Animated.View entering={FadeInDown.delay(180).springify()}>
            <Button
              label="Entrar"
              size="lg"
              haptic="medium"
              loading={submitting}
              onPress={handleSubmit}
              full
            />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 28, justifyContent: 'center', gap: 16 },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    color: colors.text,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 6,
    fontFamily: 'Menlo',
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    fontSize: 13,
  },
});
