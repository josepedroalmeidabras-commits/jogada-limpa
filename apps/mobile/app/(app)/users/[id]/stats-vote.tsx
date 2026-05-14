import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { fetchProfile, type Profile } from '@/lib/profile';
import {
  type AggregateStat,
  canVoteOnPlayer,
  categoriesForPosition,
  fetchMyVotesFor,
  fetchPlayerStats,
  ratingColor,
  ratingLabel,
  setStatVote,
  STAT_ICONS,
  STAT_LABELS,
  type StatCategory,
} from '@/lib/player-stats';
import { fetchPreferredPosition } from '@/lib/reviews';
import { useAuth } from '@/providers/auth';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Eyebrow, Heading } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

// Quanto é que um voto "+" ou "-" desloca o teu voto vs o valor atual agregado.
const DELTA = 5;
const MIN_VAL = 1;
const MAX_VAL = 99;

function clamp(n: number): number {
  return Math.max(MIN_VAL, Math.min(MAX_VAL, Math.round(n)));
}

const TIERS: { value: number; label: string }[] = [
  { value: 30, label: 'Casual' },
  { value: 50, label: 'Médio' },
  { value: 65, label: 'Bom' },
  { value: 80, label: 'Muito bom' },
  { value: 95, label: 'Elite' },
];

function nearestTier(value: number | undefined): number | null {
  if (value === undefined) return null;
  return TIERS.reduce(
    (closest, t) =>
      Math.abs(t.value - value) < Math.abs(closest - value)
        ? t.value
        : closest,
    TIERS[0]!.value,
  );
}

export default function StatsVoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [eligible, setEligible] = useState(false);
  const [myVotes, setMyVotes] = useState<
    Record<StatCategory, number | undefined>
  >({} as Record<StatCategory, number | undefined>);
  const [pending, setPending] = useState<Record<StatCategory, number>>(
    {} as Record<StatCategory, number>,
  );
  // valores agregados atuais (média da equipa) — usado no modo teammate
  const [aggregates, setAggregates] = useState<
    Record<StatCategory, AggregateStat>
  >({} as Record<StatCategory, AggregateStat>);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isSelf = session?.user.id === id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [p, votes, can, pos] = await Promise.all([
        fetchProfile(id),
        fetchMyVotesFor(id),
        canVoteOnPlayer(id),
        fetchPreferredPosition(id),
      ]);
      if (cancelled) return;
      setProfile(p);
      setPosition(pos);
      setMyVotes(votes);
      const cats = categoriesForPosition(pos);
      const init: Record<string, number> = {};
      for (const c of cats) {
        const existing = votes[c];
        if (existing !== undefined) {
          init[c] = nearestTier(existing) ?? existing;
        }
      }
      setPending(init as Record<StatCategory, number>);
      setEligible(can);

      // Para modo teammate, carregar a média atual de cada atributo
      const aggList = await fetchPlayerStats(id, pos);
      if (cancelled) return;
      const aggMap: Record<string, AggregateStat> = {};
      for (const a of aggList) aggMap[a.category] = a;
      setAggregates(aggMap as Record<StatCategory, AggregateStat>);

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function pick(cat: StatCategory, value: number) {
    setPending((prev) => ({ ...prev, [cat]: value }));
  }

  // Modo teammate: aplica um delta (−5 / 0 / +5) sobre o valor atual agregado
  // (ou o teu voto anterior se já existir).
  function suggest(cat: StatCategory, delta: number) {
    const agg = aggregates[cat]?.value ?? 0;
    const baseline = myVotes[cat] ?? (agg > 0 ? agg : 50);
    setPending((prev) => ({ ...prev, [cat]: clamp(baseline + delta) }));
  }

  async function handleSave() {
    if (!id) return;
    const entries = (Object.entries(pending) as Array<[StatCategory, number]>)
      .filter(([cat, val]) => val !== myVotes[cat]);
    if (entries.length === 0) {
      router.back();
      return;
    }
    setSubmitting(true);
    let firstError: string | null = null;
    for (const [cat, val] of entries) {
      const r = await setStatVote(id, cat, val);
      if (!r.ok && !firstError) firstError = r.message;
    }
    setSubmitting(false);
    if (firstError) {
      Alert.alert('Erro', firstError);
      return;
    }
    router.back();
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>Jogador não encontrado.</Text>
        </View>
      </Screen>
    );
  }

  if (!eligible) {
    return (
      <Screen>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: 'Votar atributos',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>
            Só colegas de equipa podem votar nos atributos deste jogador.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: isSelf ? 'Os meus atributos' : 'Votar atributos',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.hero}
        >
          <Avatar url={profile.photo_url} name={profile.name} size={72} />
          <Heading level={2} style={{ marginTop: 12 }}>
            {profile.name}
          </Heading>
          <Text style={styles.heroHint}>
            {isSelf
              ? 'Sugere os teus próprios valores. Os colegas vão poder ajustar.'
              : 'Sugere subir ou descer cada atributo. A média dos votos é o que aparece no perfil.'}
          </Text>
        </Animated.View>

        {categoriesForPosition(position).map((cat, i) => {
          const current = pending[cat];
          const agg = aggregates[cat];
          const aggValue = agg?.value ?? 0;
          return (
            <Animated.View
              key={cat}
              entering={FadeInDown.delay(80 + i * 30).springify()}
              style={styles.section}
            >
              <View style={styles.sectionHeader}>
                <Eyebrow>
                  {`${STAT_ICONS[cat]}  ${STAT_LABELS[cat]}`}
                </Eyebrow>
                {!isSelf && aggValue > 0 && (
                  <Text style={styles.aggValue}>
                    {`atual: `}
                    <Text
                      style={{
                        color: ratingColor(aggValue),
                        fontWeight: '800',
                      }}
                    >
                      {aggValue}
                    </Text>
                  </Text>
                )}
              </View>
              <Card style={{ marginTop: 8 }}>
                {isSelf ? (
                  // MODO SELF — tier picker
                  <View style={styles.tierRow}>
                    {TIERS.map((tier) => {
                      const active = current === tier.value;
                      return (
                        <Pressable
                          key={tier.value}
                          onPress={() => pick(cat, tier.value)}
                          style={[
                            styles.tier,
                            active && {
                              borderColor: ratingColor(tier.value),
                              backgroundColor: 'rgba(255,255,255,0.03)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tierValue,
                              active && { color: ratingColor(tier.value) },
                            ]}
                          >
                            {tier.value}
                          </Text>
                          <Text
                            style={[
                              styles.tierLabel,
                              active && { color: colors.text },
                            ]}
                          >
                            {tier.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  // MODO TEAMMATE — sugerir subir / igual / descer
                  <View style={styles.suggestRow}>
                    <Pressable
                      onPress={() => suggest(cat, -DELTA)}
                      style={[
                        styles.suggestBtn,
                        current !== undefined &&
                          current < (myVotes[cat] ?? aggValue) &&
                          styles.suggestBtnDown,
                      ]}
                    >
                      <Text style={styles.suggestIcon}>−</Text>
                      <Text style={styles.suggestLabel}>Pior</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => suggest(cat, 0)}
                      style={[
                        styles.suggestBtn,
                        current !== undefined &&
                          current === (myVotes[cat] ?? aggValue) &&
                          styles.suggestBtnEq,
                      ]}
                    >
                      <Text style={styles.suggestIcon}>=</Text>
                      <Text style={styles.suggestLabel}>Igual</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => suggest(cat, DELTA)}
                      style={[
                        styles.suggestBtn,
                        current !== undefined &&
                          current > (myVotes[cat] ?? aggValue) &&
                          styles.suggestBtnUp,
                      ]}
                    >
                      <Text style={styles.suggestIcon}>+</Text>
                      <Text style={styles.suggestLabel}>Melhor</Text>
                    </Pressable>
                  </View>
                )}

                {current !== undefined && (
                  <Text style={styles.summary}>
                    <Text
                      style={{
                        color: ratingColor(current),
                        fontWeight: '800',
                      }}
                    >
                      {current}
                    </Text>
                    {`  · ${ratingLabel(current)}`}
                    {myVotes[cat] !== undefined && myVotes[cat] !== current && (
                      <Text style={{ color: colors.textDim }}>
                        {`  (antes ${myVotes[cat]})`}
                      </Text>
                    )}
                  </Text>
                )}
              </Card>
            </Animated.View>
          );
        })}

        <View style={{ marginTop: 24 }}>
          <Button
            label="Guardar votos"
            size="lg"
            haptic="medium"
            loading={submitting}
            disabled={Object.keys(pending).length === 0}
            onPress={handleSave}
            full
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  hero: { alignItems: 'center', marginBottom: 8 },
  heroHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 12,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  section: { marginTop: 18 },
  tierRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tier: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
  },
  tierValue: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tierLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  summary: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  aggValue: {
    color: colors.textDim,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  suggestRow: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    gap: 4,
  },
  suggestBtnDown: {
    borderColor: '#fb923c',
    backgroundColor: 'rgba(251,146,60,0.08)',
  },
  suggestBtnEq: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  suggestBtnUp: {
    borderColor: '#84cc16',
    backgroundColor: 'rgba(132,204,22,0.08)',
  },
  suggestIcon: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 24,
  },
  suggestLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
