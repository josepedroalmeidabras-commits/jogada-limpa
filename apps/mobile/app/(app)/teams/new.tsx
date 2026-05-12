import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchActiveSports, type ActiveSport } from '@/lib/profile';
import { createTeam } from '@/lib/teams';

export default function NewTeamScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [sports, setSports] = useState<ActiveSport[]>([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [name, setName] = useState('');
  const [city, setCity] = useState('Coimbra');
  const [sportId, setSportId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchActiveSports();
      if (!cancelled) {
        setSports(data);
        setLoadingSports(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    setError(null);

    if (!session) {
      setError('Sessão inválida.');
      return;
    }
    if (!name.trim()) {
      setError('Dá um nome à equipa.');
      return;
    }
    if (!city.trim()) {
      setError('Cidade obrigatória.');
      return;
    }
    if (!sportId) {
      setError('Escolhe o desporto da equipa.');
      return;
    }

    setSubmitting(true);
    const result = await createTeam(session.user.id, {
      name: name.trim(),
      city: city.trim(),
      sport_id: sportId,
    });
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
          headerTitle: 'Criar equipa',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Nome da equipa</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Os Estagiários"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            editable={!submitting}
          />

          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.input}
            placeholder="Coimbra"
            placeholderTextColor="#666"
            value={city}
            onChangeText={setCity}
            editable={!submitting}
          />

          <Text style={[styles.label, { marginTop: 24 }]}>Desporto</Text>
          {loadingSports ? (
            <ActivityIndicator color="#ffffff" style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.sportsRow}>
              {sports.map((s) => {
                const picked = sportId === s.id;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSportId(s.id)}
                    disabled={submitting}
                    style={[styles.chip, picked && styles.chipPicked]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        picked && styles.chipTextPicked,
                      ]}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submit, submitting && styles.submitDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Criar equipa</Text>
            )}
          </Pressable>

          <Text style={styles.hint}>
            Serás o capitão. Podes convidar membros depois com um link/código.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  label: {
    color: '#a3a3a3',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  sportsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipPicked: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  chipText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  chipTextPicked: { color: '#000000' },
  submit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  hint: {
    color: '#737373',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
  },
});
