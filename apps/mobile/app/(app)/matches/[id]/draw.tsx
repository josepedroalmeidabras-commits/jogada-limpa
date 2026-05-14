import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from 'react-native-reanimated';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import * as Haptics from 'expo-haptics';
import { fetchMatchById, type MatchSummary } from '@/lib/matches';
import { fetchMatchParticipants, type MatchParticipant } from '@/lib/result';
import { assignInternalSides } from '@/lib/internal-match';
import { useAuth } from '@/providers/auth';
import { supabase } from '@/lib/supabase';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Heading, Eyebrow } from '@/components/Heading';
import { colors } from '@/theme';

type Phase =
  | 'idle'
  | 'drawing'
  | 'pick_captains'
  | 'coin_flip'
  | 'picking'
  | 'done';
type Mode = 'random' | 'balanced' | 'school';

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// Greedy balanced split: sort by overall desc, assign each player to the
// side with lower running total. Produces two teams with similar overalls.
function balancedSplit<T extends { user_id: string }>(
  players: T[],
  overallById: Map<string, number>,
): { a: T[]; b: T[] } {
  const sorted = players.slice().sort((x, y) => {
    const ox = overallById.get(x.user_id) ?? 0;
    const oy = overallById.get(y.user_id) ?? 0;
    return oy - ox;
  });
  const a: T[] = [];
  const b: T[] = [];
  let totalA = 0;
  let totalB = 0;
  for (const p of sorted) {
    const v = overallById.get(p.user_id) ?? 0;
    // tie-break: when totals equal, prefer the smaller side
    const goesToA =
      totalA < totalB || (totalA === totalB && a.length <= b.length);
    if (goesToA) {
      a.push(p);
      totalA += v;
    } else {
      b.push(p);
      totalB += v;
    }
  }
  return { a, b };
}

export default function DrawScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [confirmed, setConfirmed] = useState<MatchParticipant[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sideA, setSideA] = useState<MatchParticipant[]>([]);
  const [sideB, setSideB] = useState<MatchParticipant[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  // School-pick mode state
  const [schoolPicked, setSchoolPicked] = useState<string[]>([]); // [capA_id, capB_id]
  const [schoolFirst, setSchoolFirst] = useState<'A' | 'B' | null>(null);
  const [schoolTurn, setSchoolTurn] = useState<'A' | 'B'>('A');

  const load = useCallback(async () => {
    if (!id) return;
    const [m, parts] = await Promise.all([
      fetchMatchById(id),
      fetchMatchParticipants(id),
    ]);
    setMatch(m);
    const accepted = parts.filter(
      (p) => p.invitation_status === 'accepted',
    );
    setConfirmed(accepted);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function runDraw(mode: Mode) {
    if (confirmed.length < 2) {
      Alert.alert('Faltam jogadores', 'Pelo menos 2 confirmados para sortear.');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('drawing');
    setSideA([]);
    setSideB([]);
    setRevealIndex(0);

    let targetA: MatchParticipant[];
    let targetB: MatchParticipant[];
    let order: MatchParticipant[];

    if (mode === 'balanced') {
      // Fetch each confirmed player's overall (avg of their stat votes)
      const userIds = confirmed.map((p) => p.user_id);
      const { data: rows } = await supabase
        .from('player_stats_aggregate')
        .select('user_id, value')
        .in('user_id', userIds);
      const sum = new Map<string, number>();
      const cnt = new Map<string, number>();
      for (const r of (rows ?? []) as Array<{ user_id: string; value: number }>) {
        sum.set(r.user_id, (sum.get(r.user_id) ?? 0) + Number(r.value));
        cnt.set(r.user_id, (cnt.get(r.user_id) ?? 0) + 1);
      }
      const overall = new Map<string, number>();
      for (const uid of userIds) {
        const c = cnt.get(uid) ?? 0;
        overall.set(uid, c > 0 ? (sum.get(uid) ?? 0) / c : 0);
      }
      const split = balancedSplit(confirmed, overall);
      targetA = split.a;
      targetB = split.b;
      // Reveal order alternates A, B, A, B... for dramatic effect
      order = [];
      const aQueue = split.a.slice();
      const bQueue = split.b.slice();
      while (aQueue.length || bQueue.length) {
        if (aQueue.length) order.push(aQueue.shift()!);
        if (bQueue.length) order.push(bQueue.shift()!);
      }
    } else {
      const shuffled = shuffle(confirmed);
      const half = Math.ceil(shuffled.length / 2);
      targetA = shuffled.slice(0, half);
      targetB = shuffled.slice(half);
      order = shuffled;
    }

    // Reveal one player at a time
    const total = order.length;
    for (let i = 0; i < total; i++) {
      await new Promise((r) => setTimeout(r, 380));
      const player = order[i]!;
      const goesToA = targetA.includes(player);
      if (goesToA) {
        setSideA((prev) => [...prev, player]);
      } else {
        setSideB((prev) => [...prev, player]);
      }
      setRevealIndex(i + 1);
      void Haptics.selectionAsync();
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('done');
  }

  function resetDraw() {
    setPhase('idle');
    setSideA([]);
    setSideB([]);
    setRevealIndex(0);
    setSchoolPicked([]);
    setSchoolFirst(null);
    setSchoolTurn('A');
  }

  function startSchoolMode() {
    if (confirmed.length < 4) {
      Alert.alert(
        'Faltam jogadores',
        'Precisas de pelo menos 4 confirmados para escolher equipas à escola.',
      );
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSchoolPicked([]);
    setSchoolFirst(null);
    setSideA([]);
    setSideB([]);
    setPhase('pick_captains');
  }

  function toggleCaptainPick(userId: string) {
    void Haptics.selectionAsync();
    setSchoolPicked((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length >= 2) return prev;
      return [...prev, userId];
    });
  }

  async function runCoinFlip() {
    if (schoolPicked.length !== 2) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('coin_flip');
    // Auto-add captains to their respective sides
    const [capAId, capBId] = schoolPicked;
    const capA = confirmed.find((p) => p.user_id === capAId)!;
    const capB = confirmed.find((p) => p.user_id === capBId)!;
    setSideA([capA]);
    setSideB([capB]);
    // Brief animation delay then pick first
    await new Promise((r) => setTimeout(r, 1200));
    const first: 'A' | 'B' = Math.random() < 0.5 ? 'A' : 'B';
    setSchoolFirst(first);
    setSchoolTurn(first);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise((r) => setTimeout(r, 900));
    setPhase('picking');
  }

  function schoolPickPlayer(player: MatchParticipant) {
    void Haptics.selectionAsync();
    if (schoolTurn === 'A') {
      setSideA((prev) => [...prev, player]);
    } else {
      setSideB((prev) => [...prev, player]);
    }
    // Switch turn unless pool is now empty
    const remainingAfter = confirmed.filter(
      (p) =>
        p.user_id !== player.user_id &&
        ![...sideA, ...sideB].some((q) => q.user_id === p.user_id),
    );
    if (remainingAfter.length === 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase('done');
    } else {
      setSchoolTurn(schoolTurn === 'A' ? 'B' : 'A');
    }
  }

  async function confirmDraw() {
    if (!id) return;
    setSubmitting(true);
    const r = await assignInternalSides(
      id,
      sideA.map((p) => p.user_id),
      sideB.map((p) => p.user_id),
    );
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    Alert.alert('Sorteio confirmado', 'Os lados estão definidos.', [
      { text: 'OK', onPress: () => router.replace(`/(app)/matches/${id}`) },
    ]);
  }

  if (loading) {
    return (
      <Screen>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: 'Sorteio',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (!match || !match.is_internal) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>
            O sorteio só está disponível para peladinhas internas.
          </Text>
        </View>
      </Screen>
    );
  }

  const labelA = match.side_a_label ?? 'Coletes';
  const labelB = match.side_b_label ?? 'Sem coletes';

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Sorteio',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <Eyebrow>{`${confirmed.length} confirmado${confirmed.length === 1 ? '' : 's'}`}</Eyebrow>
          <Heading level={2} style={{ marginTop: 6 }}>
            {phase === 'idle'
              ? 'Sorteio dos lados'
              : phase === 'drawing'
                ? 'A sortear…'
                : phase === 'pick_captains'
                  ? 'Escolhe os 2 capitães'
                  : phase === 'coin_flip'
                    ? 'A sortear quem escolhe primeiro…'
                    : phase === 'picking'
                      ? schoolTurn === 'A'
                        ? `Vez de ${sideA[0]?.profile?.name?.split(' ')[0] ?? 'A'}`
                        : `Vez de ${sideB[0]?.profile?.name?.split(' ')[0] ?? 'B'}`
                      : 'Lados sorteados 🎲'}
          </Heading>
          <Text style={styles.hint}>
            {phase === 'idle'
              ? 'Quem fica com coletes? Toca em "Sortear" para distribuir aleatoriamente.'
              : phase === 'drawing'
                ? `Jogador ${revealIndex} de ${confirmed.length}…`
                : phase === 'pick_captains'
                  ? 'Toca em 2 jogadores que vão escolher os seus colegas.'
                  : phase === 'coin_flip'
                    ? schoolFirst
                      ? `Começa o lado ${schoolFirst}!`
                      : 'A sortear o primeiro a escolher…'
                    : phase === 'picking'
                      ? 'Toca num jogador da pool para o adicionar à tua equipa.'
                      : 'Confirma para guardar a distribuição.'}
          </Text>
        </Animated.View>

        {phase === 'idle' && (
          <Animated.View
            entering={FadeIn.delay(80).duration(300)}
            style={styles.section}
          >
            <Eyebrow>Disponíveis</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              <View style={styles.poolGrid}>
                {confirmed.length === 0 ? (
                  <Text style={styles.muted}>
                    Ninguém confirmou ainda. Aguarda confirmações ou usa a
                    distribuição manual.
                  </Text>
                ) : (
                  confirmed.map((p) => (
                    <View key={p.user_id} style={styles.poolCell}>
                      <Avatar
                        url={p.profile?.photo_url ?? null}
                        name={p.profile?.name ?? '?'}
                        size={44}
                      />
                      <Text style={styles.poolName} numberOfLines={1}>
                        {(p.profile?.name ?? 'Jogador').split(' ')[0]}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </Card>
          </Animated.View>
        )}

        {phase === 'pick_captains' && (
          <Animated.View
            entering={FadeIn.delay(80).duration(300)}
            style={styles.section}
          >
            <Eyebrow>{`${schoolPicked.length}/2 escolhidos`}</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              <View style={styles.poolGrid}>
                {confirmed.map((p) => {
                  const picked = schoolPicked.includes(p.user_id);
                  return (
                    <Pressable
                      key={p.user_id}
                      onPress={() => toggleCaptainPick(p.user_id)}
                      style={[
                        styles.poolCell,
                        picked && styles.poolCellPicked,
                      ]}
                    >
                      <Avatar
                        url={p.profile?.photo_url ?? null}
                        name={p.profile?.name ?? '?'}
                        size={44}
                      />
                      <Text style={styles.poolName} numberOfLines={1}>
                        {(p.profile?.name ?? 'Jogador').split(' ')[0]}
                      </Text>
                      {picked && (
                        <View style={styles.poolBadge}>
                          <Text style={styles.poolBadgeText}>
                            {schoolPicked.indexOf(p.user_id) + 1}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </Animated.View>
        )}

        {phase === 'coin_flip' && (
          <Animated.View
            entering={ZoomIn.duration(400).springify()}
            style={[styles.section, { alignItems: 'center' }]}
          >
            <View style={styles.coinFlip}>
              <Text style={styles.coinFlipEmoji}>
                {schoolFirst ? '🏆' : '🪙'}
              </Text>
              {schoolFirst && (
                <Animated.Text
                  entering={ZoomIn.duration(300).springify()}
                  style={styles.coinFlipText}
                >
                  {`Começa ${schoolFirst === 'A'
                    ? sideA[0]?.profile?.name?.split(' ')[0]
                    : sideB[0]?.profile?.name?.split(' ')[0]}!`}
                </Animated.Text>
              )}
            </View>
          </Animated.View>
        )}

        {phase === 'picking' && (() => {
          const remaining = confirmed.filter(
            (p) =>
              ![...sideA, ...sideB].some((q) => q.user_id === p.user_id),
          );
          return (
            <Animated.View
              entering={FadeIn.duration(280)}
              style={styles.section}
            >
              <Eyebrow>{`${remaining.length} por escolher`}</Eyebrow>
              <Card style={{ marginTop: 8 }}>
                <View style={styles.poolGrid}>
                  {remaining.map((p) => (
                    <Pressable
                      key={p.user_id}
                      onPress={() => schoolPickPlayer(p)}
                      style={[
                        styles.poolCell,
                        schoolTurn === 'A'
                          ? styles.poolCellTurnA
                          : styles.poolCellTurnB,
                      ]}
                    >
                      <Avatar
                        url={p.profile?.photo_url ?? null}
                        name={p.profile?.name ?? '?'}
                        size={44}
                      />
                      <Text style={styles.poolName} numberOfLines={1}>
                        {(p.profile?.name ?? 'Jogador').split(' ')[0]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            </Animated.View>
          );
        })()}

        {(phase === 'drawing' ||
          phase === 'done' ||
          phase === 'coin_flip' ||
          phase === 'picking') && (
          <View style={[styles.section, styles.sidesGrid]}>
            <View style={[styles.sideCol, styles.sideA]}>
              <Text style={styles.sideTitle}>{labelA.toUpperCase()}</Text>
              <View style={styles.sideList}>
                {sideA.map((p) => (
                  <Animated.View
                    key={p.user_id}
                    entering={ZoomIn.duration(280).springify()}
                    style={styles.sideRow}
                  >
                    <Avatar
                      url={p.profile?.photo_url ?? null}
                      name={p.profile?.name ?? '?'}
                      size={28}
                    />
                    <Text style={styles.sideName} numberOfLines={1}>
                      {(p.profile?.name ?? 'Jogador').split(' ')[0]}
                    </Text>
                  </Animated.View>
                ))}
                {sideA.length === 0 && (
                  <Text style={styles.sideEmpty}>—</Text>
                )}
              </View>
              <Text style={styles.sideCount}>{sideA.length}</Text>
            </View>
            <View style={[styles.sideCol, styles.sideB]}>
              <Text style={styles.sideTitle}>{labelB.toUpperCase()}</Text>
              <View style={styles.sideList}>
                {sideB.map((p) => (
                  <Animated.View
                    key={p.user_id}
                    entering={ZoomIn.duration(280).springify()}
                    style={styles.sideRow}
                  >
                    <Avatar
                      url={p.profile?.photo_url ?? null}
                      name={p.profile?.name ?? '?'}
                      size={28}
                    />
                    <Text style={styles.sideName} numberOfLines={1}>
                      {(p.profile?.name ?? 'Jogador').split(' ')[0]}
                    </Text>
                  </Animated.View>
                ))}
                {sideB.length === 0 && (
                  <Text style={styles.sideEmpty}>—</Text>
                )}
              </View>
              <Text style={styles.sideCount}>{sideB.length}</Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          {phase === 'idle' ? (
            <View style={{ gap: 10 }}>
              <Button
                label="🎲 Sorteio aleatório"
                size="lg"
                haptic="medium"
                disabled={confirmed.length < 2}
                onPress={() => runDraw('random')}
                full
              />
              <Button
                label="⚖️ Sorteio equilibrado (por stats)"
                variant="secondary"
                size="lg"
                haptic="light"
                disabled={confirmed.length < 2}
                onPress={() => runDraw('balanced')}
                full
              />
              <Button
                label="🏫 Escolha à escola"
                variant="ghost"
                size="lg"
                haptic="light"
                disabled={confirmed.length < 4}
                onPress={startSchoolMode}
                full
              />
              <Text style={styles.modeHint}>
                Equilibrado distribui por stats. À escola: 2 jogadores
                escolhem alternadamente quem quer na sua equipa.
              </Text>
            </View>
          ) : phase === 'drawing' ? (
            <Button
              label="A sortear…"
              size="lg"
              loading
              full
              onPress={() => {}}
            />
          ) : phase === 'pick_captains' ? (
            <View style={{ gap: 8 }}>
              <Button
                label="Confirmar capitães"
                size="lg"
                haptic="medium"
                disabled={schoolPicked.length !== 2}
                onPress={runCoinFlip}
                full
              />
              <Button
                label="Cancelar"
                variant="ghost"
                onPress={resetDraw}
                full
              />
            </View>
          ) : phase === 'coin_flip' ? (
            <Button label="A sortear…" size="lg" loading full onPress={() => {}} />
          ) : phase === 'picking' ? (
            <Button
              label="Cancelar"
              variant="ghost"
              onPress={resetDraw}
              full
            />
          ) : (
            <Animated.View
              entering={FadeInUp.duration(280).springify()}
              style={{ gap: 8 }}
            >
              <Button
                label="Confirmar sorteio"
                size="lg"
                haptic="medium"
                loading={submitting}
                onPress={confirmDraw}
                full
              />
              <Button
                label="🔄 Refazer"
                variant="secondary"
                disabled={submitting}
                onPress={resetDraw}
                full
              />
            </Animated.View>
          )}
          {phase === 'idle' && (
            <Pressable
              onPress={() => router.push(`/(app)/matches/${id}/split`)}
              style={{ marginTop: 12, alignSelf: 'center' }}
            >
              <Text style={styles.manualLink}>
                Preferes distribuir manualmente?
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 8, lineHeight: 19 },
  section: { marginTop: 24 },
  poolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  poolCell: { width: 64, alignItems: 'center', gap: 6, position: 'relative' },
  poolCellPicked: {
    opacity: 1,
    transform: [{ scale: 1.05 }],
  },
  poolCellTurnA: {
    borderRadius: 12,
  },
  poolCellTurnB: {
    borderRadius: 12,
  },
  poolBadge: {
    position: 'absolute',
    top: -4,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  poolBadgeText: {
    color: '#0E1812',
    fontSize: 12,
    fontWeight: '900',
  },
  coinFlip: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  coinFlipEmoji: {
    fontSize: 84,
  },
  coinFlipText: {
    color: colors.goldDeep,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 18,
    textAlign: 'center',
  },
  poolName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  sidesGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  sideCol: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 240,
  },
  sideA: {
    borderColor: 'rgba(201,162,107,0.5)',
    backgroundColor: 'rgba(201,162,107,0.06)',
  },
  sideB: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sideTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  sideList: { flex: 1, gap: 6 },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sideName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sideEmpty: { color: colors.textDim, fontSize: 12, textAlign: 'center' },
  sideCount: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 8,
    textAlign: 'center',
  },
  actions: { marginTop: 28 },
  manualLink: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  modeHint: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
