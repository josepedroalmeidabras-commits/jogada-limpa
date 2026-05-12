import { useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  createProfile,
  fetchActiveSports,
  type ActiveSport,
} from '@/lib/profile';

type SportPick = { sport_id: number; declared_level: number };

const LEVEL_LABELS: Record<number, string> = {
  1: 'Casual',
  4: 'Intermédio',
  7: 'Avançado',
  9: 'Competitivo',
};

function levelLabel(n: number) {
  if (n <= 3) return 'Casual';
  if (n <= 6) return 'Intermédio';
  if (n <= 8) return 'Avançado';
  return 'Competitivo';
}

function parseBirthdate(input: string): string | null {
  // expects DD/MM/YYYY
  const m = input.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function formatBirthdateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isAdult(isoDate: string): boolean {
  const dob = new Date(`${isoDate}T00:00:00Z`);
  const eighteen = new Date();
  eighteen.setUTCFullYear(eighteen.getUTCFullYear() - 18);
  return dob.getTime() <= eighteen.getTime();
}

export default function OnboardingScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [sports, setSports] = useState<ActiveSport[]>([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [city, setCity] = useState('Coimbra');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [picks, setPicks] = useState<SportPick[]>([]);
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

  const pickedSet = useMemo(
    () => new Set(picks.map((p) => p.sport_id)),
    [picks],
  );

  function toggleSport(sportId: number) {
    setPicks((prev) =>
      prev.some((p) => p.sport_id === sportId)
        ? prev.filter((p) => p.sport_id !== sportId)
        : [...prev, { sport_id: sportId, declared_level: 5 }],
    );
  }

  function setSportLevel(sportId: number, level: number) {
    setPicks((prev) =>
      prev.map((p) =>
        p.sport_id === sportId ? { ...p, declared_level: level } : p,
      ),
    );
  }

  async function handleSubmit() {
    setError(null);

    if (!session) {
      setError('Sessão inválida. Volta a entrar.');
      return;
    }
    if (!name.trim()) {
      setError('Diz-nos o teu nome.');
      return;
    }
    const iso = parseBirthdate(birthdate);
    if (!iso) {
      setError('Data de nascimento inválida. Usa o formato DD/MM/AAAA.');
      return;
    }
    if (!isAdult(iso)) {
      setError('Esta app é só para maiores de 18 anos.');
      return;
    }
    if (!city.trim()) {
      setError('Cidade obrigatória.');
      return;
    }
    if (!acceptedTos) {
      setError('Tens de aceitar os termos.');
      return;
    }
    if (picks.length === 0) {
      setError('Escolhe pelo menos um desporto.');
      return;
    }

    setSubmitting(true);
    const result = await createProfile(session.user.id, {
      name: name.trim(),
      birthdate: iso,
      city: city.trim(),
      sports: picks,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace('/(app)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Quase lá</Text>
          <Text style={styles.subtitle}>Vamos completar o teu perfil.</Text>

          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: José Pedro"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
            editable={!submitting}
          />

          <Text style={styles.label}>Data de nascimento (DD/MM/AAAA)</Text>
          <TextInput
            style={styles.input}
            placeholder="01/01/1990"
            placeholderTextColor="#666"
            value={birthdate}
            onChangeText={(text) => setBirthdate(formatBirthdateInput(text))}
            keyboardType="number-pad"
            editable={!submitting}
            maxLength={10}
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

          <Text style={[styles.label, { marginTop: 24 }]}>
            Desportos que jogas
          </Text>

          {loadingSports ? (
            <ActivityIndicator color="#ffffff" style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.sportsRow}>
              {sports.map((s) => {
                const picked = pickedSet.has(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => toggleSport(s.id)}
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

          {picks.map((pick) => {
            const sport = sports.find((s) => s.id === pick.sport_id);
            if (!sport) return null;
            return (
              <View key={pick.sport_id} style={styles.levelBlock}>
                <Text style={styles.levelLabel}>
                  Nível em {sport.name}:{' '}
                  <Text style={styles.levelValue}>
                    {pick.declared_level} · {levelLabel(pick.declared_level)}
                  </Text>
                </Text>
                <View style={styles.levelRow}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                    const active = pick.declared_level >= n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setSportLevel(pick.sport_id, n)}
                        disabled={submitting}
                        style={[styles.dot, active && styles.dotActive]}
                      >
                        <Text
                          style={[
                            styles.dotText,
                            active && styles.dotTextActive,
                          ]}
                        >
                          {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <Pressable
            onPress={() => setAcceptedTos(!acceptedTos)}
            disabled={submitting}
            style={styles.tosRow}
          >
            <View
              style={[styles.checkbox, acceptedTos && styles.checkboxChecked]}
            >
              {acceptedTos && <Text style={styles.checkboxMark}>✓</Text>}
            </View>
            <Text style={styles.tosText}>
              Confirmo que tenho 18 anos ou mais e aceito os Termos.
            </Text>
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submit, submitting && styles.submitDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Guardar perfil</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#a3a3a3',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
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
  chipPicked: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  chipText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  chipTextPicked: { color: '#000000' },
  levelBlock: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  levelLabel: { color: '#ffffff', fontSize: 14, marginBottom: 12 },
  levelValue: { color: '#a3a3a3', fontWeight: '500' },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: '#ffffff' },
  dotText: { color: '#a3a3a3', fontSize: 12 },
  dotTextActive: { color: '#000000', fontWeight: '600' },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  checkboxMark: { color: '#000000', fontWeight: '800' },
  tosText: { color: '#d4d4d4', flex: 1, fontSize: 14 },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
  },
  submit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#000000', fontSize: 16, fontWeight: '600' },
});
