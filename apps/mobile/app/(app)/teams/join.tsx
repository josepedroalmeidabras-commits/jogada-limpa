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
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { joinTeamByCode } from '@/lib/teams';

export default function JoinTeamScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Entrar com código',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Tens um código?</Text>
          <Text style={styles.subtitle}>
            Cola aqui o código de 8 caracteres que recebeste do capitão.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="ex: 3f2a8b1c"
            placeholderTextColor="#666"
            value={code}
            onChangeText={(v) => setCode(v.trim().toLowerCase())}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={8}
            editable={!submitting}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submit, submitting && styles.submitDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Entrar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#a3a3a3',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: '#ffffff',
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: 'Courier',
  },
  submit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  error: { color: '#f87171', textAlign: 'center', fontSize: 13 },
});
