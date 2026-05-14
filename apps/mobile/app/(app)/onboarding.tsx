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
import {
  categoriesForPosition,
  ratingColor,
  ratingLabel,
  setStatVote,
  STAT_ICONS,
  STAT_LABELS,
  type StatCategory,
} from '@/lib/player-stats';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { colors } from '@/theme';

const STAT_TIERS: { value: number; label: string }[] = [
  { value: 30, label: 'Casual' },
  { value: 50, label: 'Médio' },
  { value: 65, label: 'Bom' },
  { value: 80, label: 'Muito bom' },
  { value: 95, label: 'Elite' },
];

type SportPick = {
  sport_id: number;
  declared_level: number;
  preferred_position: string | null;
};

const POSITIONS: { value: string; label: string }[] = [
  { value: 'gr', label: '🧤 GR' },
  { value: 'def', label: 'Defesa' },
  { value: 'med', label: 'Médio' },
  { value: 'ata', label: 'Avançado' },
];

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

  const [step, setStep] = useState<'profile' | 'stats' | 'team'>('profile');
  const [sports, setSports] = useState<ActiveSport[]>([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [city, setCity] = useState('Coimbra');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [picks, setPicks] = useState<SportPick[]>([]);
  const [statValues, setStatValues] = useState<
    Record<StatCategory, number>
  >({} as Record<StatCategory, number>);
  const [savingStats, setSavingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // posição da primeira modalidade escolhida (ou null → outfield)
  const primaryPosition = picks[0]?.preferred_position ?? null;
  const statCategories = useMemo(
    () => categoriesForPosition(primaryPosition),
    [primaryPosition],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchActiveSports();
      if (!cancelled) {
        setSports(data);
        setLoadingSports(false);
        // Auto-pick todos os desportos activos (hoje só F7). User só precisa
        // de escolher a posição.
        setPicks((prev) =>
          prev.length > 0
            ? prev
            : data.map((s) => ({
                sport_id: s.id,
                declared_level: 5,
                preferred_position: null,
              })),
        );
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
        : [
            ...prev,
            { sport_id: sportId, declared_level: 5, preferred_position: null },
          ],
    );
  }

  function setSportLevel(sportId: number, level: number) {
    setPicks((prev) =>
      prev.map((p) =>
        p.sport_id === sportId ? { ...p, declared_level: level } : p,
      ),
    );
  }

  function setSportPosition(sportId: number, position: string | null) {
    setPicks((prev) =>
      prev.map((p) =>
        p.sport_id === sportId ? { ...p, preferred_position: position } : p,
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
    // Pré-popular self-rating com 50 para todas as categorias
    const init: Record<string, number> = {};
    for (const c of categoriesForPosition(picks[0]?.preferred_position ?? null)) {
      init[c] = 50;
    }
    setStatValues(init as Record<StatCategory, number>);
    setStep('stats');
  }

  function pickStat(cat: StatCategory, value: number) {
    setStatValues((prev) => ({ ...prev, [cat]: value }));
  }

  async function handleStatsSubmit() {
    if (!session) return;
    setSavingStats(true);
    // Guarda um voto self por cada atributo
    for (const cat of statCategories) {
      const v = statValues[cat] ?? 50;
      await setStatVote(session.user.id, cat, v);
    }
    setSavingStats(false);
    setStep('team');
  }

  if (step === 'stats') {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Eyebrow>Penúltimo passo</Eyebrow>
            <Heading level={1} style={{ marginTop: 6 }}>
              Como te avalias?
            </Heading>
            <Text style={styles.sub}>
              Sugere os teus próprios atributos. À medida que jogares, os
              colegas vão poder sugerir aumentar ou diminuir — a média dos
              votos é o que aparece no teu cartão.
            </Text>
          </Animated.View>

          {statCategories.map((cat, i) => {
            const current = statValues[cat] ?? 50;
            return (
              <Animated.View
                key={cat}
                entering={FadeInDown.delay(80 + i * 30).springify()}
                style={styles.statSection}
              >
                <Eyebrow>{`${STAT_ICONS[cat]}  ${STAT_LABELS[cat]}`}</Eyebrow>
                <Card style={{ marginTop: 8 }}>
                  <View style={styles.tierRow}>
                    {STAT_TIERS.map((tier) => {
                      const active = current === tier.value;
                      return (
                        <Pressable
                          key={tier.value}
                          onPress={() => pickStat(cat, tier.value)}
                          disabled={savingStats}
                          style={[
                            styles.statTier,
                            active && {
                              borderColor: ratingColor(tier.value),
                              backgroundColor: 'rgba(255,255,255,0.03)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statTierValue,
                              active && { color: ratingColor(tier.value) },
                            ]}
                          >
                            {tier.value}
                          </Text>
                          <Text
                            style={[
                              styles.statTierLabel,
                              active && { color: colors.text },
                            ]}
                          >
                            {tier.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.statSummary}>
                    <Text
                      style={{
                        color: ratingColor(current),
                        fontWeight: '800',
                      }}
                    >
                      {current}
                    </Text>
                    {`  · ${ratingLabel(current)}`}
                  </Text>
                </Card>
              </Animated.View>
            );
          })}

          <View style={{ marginTop: 24 }}>
            <Button
              label="Continuar"
              size="lg"
              haptic="medium"
              loading={savingStats}
              onPress={handleStatsSubmit}
              full
            />
            <View style={{ height: 8 }} />
            <Button
              label="Saltar"
              variant="ghost"
              full
              onPress={() => setStep('team')}
            />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (step === 'team') {
    return (
      <Screen>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Eyebrow>Último passo</Eyebrow>
            <Heading level={1} style={{ marginTop: 6 }}>
              Tens código de equipa?
            </Heading>
            <Text style={styles.sub}>
              Se um capitão te convidou, ele deu-te um código. Cola-o agora.
              Caso contrário podes explorar a app e criar ou juntar-te a uma
              equipa quando quiseres.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(120).springify()}
            style={{ marginTop: 16, gap: 12 }}
          >
            <Button
              label="Tenho código — juntar a equipa"
              size="lg"
              haptic="medium"
              full
              onPress={() => router.replace('/(app)/teams/join')}
            />
            <Button
              label="Ainda não — explorar a app"
              size="lg"
              variant="ghost"
              full
              onPress={() => router.replace('/(app)')}
            />
          </Animated.View>
        </ScrollView>
      </Screen>
    );
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

          {loadingSports ? (
            <ActivityIndicator color="#ffffff" style={{ marginTop: 24 }} />
          ) : (
            picks.map((pick) => (
              <Animated.View
                key={pick.sport_id}
                entering={FadeInDown.delay(240).springify()}
                style={{ marginTop: 24 }}
              >
                <Text style={styles.levelLabel}>Posição preferida</Text>
                <View style={styles.posRow}>
                  {POSITIONS.map((p) => {
                    const active = pick.preferred_position === p.value;
                    return (
                      <Pressable
                        key={p.value}
                        onPress={() =>
                          setSportPosition(
                            pick.sport_id,
                            active ? null : p.value,
                          )
                        }
                        disabled={submitting}
                        style={[styles.posChip, active && styles.posChipActive]}
                      >
                        <Text
                          style={[
                            styles.posChipText,
                            active && styles.posChipTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            ))
          )}

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
  posRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  posChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  posChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  posChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  posChipTextActive: { color: colors.brand },
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
  // Stats step
  statSection: { marginTop: 18 },
  tierRow: { flexDirection: 'row', gap: 6 },
  statTier: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
  },
  statTierValue: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statTierLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  statSummary: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
});
