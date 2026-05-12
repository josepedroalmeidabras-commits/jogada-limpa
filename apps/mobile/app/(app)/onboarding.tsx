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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  createProfile,
  fetchActiveSports,
  type ActiveSport,
} from '@/lib/profile';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

type SportPick = { sport_id: number; declared_level: number };

function levelLabel(n: number) {
  if (n <= 3) return 'Casual';
  if (n <= 6) return 'Intermédio';
  if (n <= 8) return 'Avançado';
  return 'Competitivo';
}

function parseBirthdate(input: string): string | null {
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
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Eyebrow>Bem-vindo a bordo</Eyebrow>
            <Heading level={1} style={{ marginTop: 6 }}>
              Quase lá
            </Heading>
            <Text style={styles.sub}>
              Conta-nos o básico para te emparelharmos com equipas do teu
              nível.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: José Pedro"
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).springify()}>
            <Text style={styles.label}>Data de nascimento</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.textFaint}
              value={birthdate}
              onChangeText={(text) => setBirthdate(formatBirthdateInput(text))}
              keyboardType="number-pad"
              editable={!submitting}
              maxLength={10}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180).springify()}>
            <Text style={styles.label}>Cidade</Text>
            <TextInput
              style={styles.input}
              placeholder="Coimbra"
              placeholderTextColor={colors.textFaint}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(240).springify()}
            style={{ marginTop: 24 }}
          >
            <Eyebrow>Desportos</Eyebrow>
            {loadingSports ? (
              <ActivityIndicator color="#ffffff" style={{ marginTop: 12 }} />
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
          </Animated.View>

          {picks.map((pick) => {
            const sport = sports.find((s) => s.id === pick.sport_id);
            if (!sport) return null;
            return (
              <Animated.View
                key={pick.sport_id}
                entering={FadeInDown.springify()}
                style={styles.levelBlock}
              >
                <Text style={styles.levelLabel}>
                  {`Nível em ${sport.name}: `}
                  <Text style={styles.levelValue}>
                    {`${pick.declared_level} · ${levelLabel(pick.declared_level)}`}
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
              </Animated.View>
            );
          })}

          <Animated.View
            entering={FadeInDown.delay(320).springify()}
            style={{ marginTop: 8 }}
          >
            <Pressable
              onPress={() => setAcceptedTos(!acceptedTos)}
              disabled={submitting}
              style={styles.tosRow}
            >
              <View
                style={[
                  styles.checkbox,
                  acceptedTos && styles.checkboxChecked,
                ]}
              >
                {acceptedTos && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.tosText}>
                Confirmo que tenho 18 anos ou mais e aceito os Termos.
              </Text>
            </Pressable>
          </Animated.View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Animated.View
            entering={FadeInDown.delay(380).springify()}
            style={{ marginTop: 24 }}
          >
            <Button
              label="Guardar perfil"
              size="lg"
              haptic="medium"
              loading={submitting}
              onPress={handleSubmit}
              full
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  sub: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 24,
    letterSpacing: -0.1,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: colors.text,
    fontSize: 16,
    letterSpacing: -0.1,
  },
  sportsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  chipPicked: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipTextPicked: { color: '#0E1812' },
  levelBlock: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  levelLabel: { color: colors.text, fontSize: 14, marginBottom: 12 },
  levelValue: { color: colors.brand, fontWeight: '700' },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: colors.brand },
  dotText: { color: colors.textMuted, fontSize: 12 },
  dotTextActive: { color: '#0E1812', fontWeight: '700' },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkboxMark: { color: '#0E1812', fontWeight: '800' },
  tosText: { color: '#d4d4d4', flex: 1, fontSize: 14, lineHeight: 20 },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
  },
});
