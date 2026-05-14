import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useLocalSearchParams } from 'expo-router';
import { fetchProfile, formatDisplayName, type Profile } from '@/lib/profile';
import { fetchUserSports, type UserSportElo } from '@/lib/reviews';
import {
  categoriesForPosition,
  fetchPlayerStats,
  overallRating,
  ratingColor,
  STAT_LABELS,
  STAT_SHORT,
  type AggregateStat,
  type StatCategory,
} from '@/lib/player-stats';
import {
  castFaceoffVote,
  fetchFaceoffTally,
  type FaceoffTally,
} from '@/lib/faceoff';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Eyebrow } from '@/components/Heading';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme';

type Snapshot = {
  profile: Profile;
  sport: UserSportElo | null;
  position: string | null;
  stats: AggregateStat[];
  overall: number;
};

async function loadSnapshot(userId: string): Promise<Snapshot | null> {
  const [p, sports] = await Promise.all([
    fetchProfile(userId),
    fetchUserSports(userId),
  ]);
  if (!p) return null;
  const sp = sports.find((x) => x.sport_id === 2) ?? sports[0] ?? null;
  const position = sp?.preferred_position ?? null;
  const stats = await fetchPlayerStats(userId, position);
  return {
    profile: p,
    sport: sp,
    position,
    stats,
    overall: overallRating(stats),
  };
}

export default function ComparePlayersScreen() {
  const { a, b, team } = useLocalSearchParams<{
    a: string;
    b: string;
    team?: string;
  }>();
  const [left, setLeft] = useState<Snapshot | null>(null);
  const [right, setRight] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [tally, setTally] = useState<FaceoffTally | null>(null);
  const [voting, setVoting] = useState(false);

  const refreshTally = useCallback(async () => {
    if (!team || !a || !b) return;
    const t = await fetchFaceoffTally(team, a, b);
    setTally(t);
  }, [team, a, b]);

  useEffect(() => {
    if (!a || !b) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [la, lb] = await Promise.all([loadSnapshot(a), loadSnapshot(b)]);
      if (cancelled) return;
      setLeft(la);
      setRight(lb);
      setLoading(false);
      if (team) {
        const t = await fetchFaceoffTally(team, a, b);
        if (!cancelled) setTally(t);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [a, b, team]);

  async function vote(winnerId: string | null) {
    if (!team || !a || !b) return;
    setVoting(true);
    const r = await castFaceoffVote(team, a, b, winnerId);
    setVoting(false);
    if (!r.ok) {
      Alert.alert('Não foi possível votar', r.message);
      return;
    }
    await refreshTally();
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Comparar',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={160} radius={20} />
            <Skeleton height={56} radius={12} />
            <Skeleton height={56} radius={12} />
          </View>
        ) : !left || !right ? (
          <View style={styles.center}>
            <Text style={styles.muted}>
              Não foi possível carregar os jogadores.
            </Text>
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(300).springify()}>
              <Card variant="subtle">
                <View style={styles.headRow}>
                  <PlayerHead snap={left} />
                  <Text style={styles.vs}>VS</Text>
                  <PlayerHead snap={right} />
                </View>
              </Card>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(80).springify()}
              style={styles.section}
            >
              <Eyebrow>Atributos</Eyebrow>
              <Card style={{ marginTop: 8 }}>
                {categoriesForPosition(
                  left.position === right.position ? left.position : null,
                ).map((cat) => (
                  <CompareRow
                    key={cat}
                    category={cat}
                    leftStats={left.stats}
                    rightStats={right.stats}
                  />
                ))}
              </Card>
            </Animated.View>

            {team && (
              <Animated.View
                entering={FadeInDown.delay(100).springify()}
                style={styles.section}
              >
                <Eyebrow>Voto dos colegas</Eyebrow>
                <Card style={{ marginTop: 8 }}>
                  {tally ? (
                    (() => {
                      const total =
                        tally.votes_for_a + tally.votes_for_b + tally.draws;
                      const pa = total > 0 ? (tally.votes_for_a / total) * 100 : 0;
                      const pb = total > 0 ? (tally.votes_for_b / total) * 100 : 0;
                      const pd = total > 0 ? (tally.draws / total) * 100 : 0;
                      return (
                        <>
                          <View style={styles.tallyRow}>
                            <Text style={styles.tallyPct}>{Math.round(pa)}%</Text>
                            <Text style={styles.tallyLabel}>
                              {total === 0
                                ? 'Sem votos ainda'
                                : `${total} voto${total === 1 ? '' : 's'}`}
                            </Text>
                            <Text style={[styles.tallyPct, { textAlign: 'right' }]}>
                              {Math.round(pb)}%
                            </Text>
                          </View>
                          <View style={styles.tallyTrack}>
                            <View
                              style={[
                                styles.tallySegA,
                                { flex: tally.votes_for_a || 0.0001 },
                              ]}
                            />
                            {tally.draws > 0 && (
                              <View
                                style={[
                                  styles.tallySegD,
                                  { flex: tally.draws },
                                ]}
                              />
                            )}
                            <View
                              style={[
                                styles.tallySegB,
                                { flex: tally.votes_for_b || 0.0001 },
                              ]}
                            />
                          </View>
                          {tally.draws > 0 && (
                            <Text style={styles.tallyDraw}>
                              {`Empate: ${Math.round(pd)}%`}
                            </Text>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <Text style={styles.muted}>A carregar votos…</Text>
                  )}
                  <View style={styles.voteRow}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={
                          tally?.my_vote === 'a' ? '✓ Voto neste' : 'Voto'
                        }
                        variant={tally?.my_vote === 'a' ? 'primary' : 'secondary'}
                        size="sm"
                        loading={voting}
                        onPress={() => vote(a)}
                        full
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={
                          tally?.my_vote === 'draw' ? '✓ Empate' : 'Empate'
                        }
                        variant={tally?.my_vote === 'draw' ? 'primary' : 'ghost'}
                        size="sm"
                        loading={voting}
                        onPress={() => vote(null)}
                        full
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={
                          tally?.my_vote === 'b' ? '✓ Voto neste' : 'Voto'
                        }
                        variant={tally?.my_vote === 'b' ? 'primary' : 'secondary'}
                        size="sm"
                        loading={voting}
                        onPress={() => vote(b)}
                        full
                      />
                    </View>
                  </View>
                </Card>
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(120).springify()}
              style={styles.section}
            >
              <Eyebrow>Geral</Eyebrow>
              <Card style={{ marginTop: 8 }}>
                <SummaryRow
                  label="Overall"
                  leftValue={left.overall > 0 ? `${left.overall}` : '—'}
                  rightValue={right.overall > 0 ? `${right.overall}` : '—'}
                  higher={
                    left.overall === right.overall
                      ? 'tie'
                      : left.overall > right.overall
                        ? 'left'
                        : 'right'
                  }
                />
                <SummaryRow
                  label="% vitórias"
                  leftValue={
                    left.sport && left.sport.win_matches > 0
                      ? `${Math.round(left.sport.win_pct)}%`
                      : '—'
                  }
                  rightValue={
                    right.sport && right.sport.win_matches > 0
                      ? `${Math.round(right.sport.win_pct)}%`
                      : '—'
                  }
                  higher={
                    (left.sport?.win_pct ?? 0) === (right.sport?.win_pct ?? 0)
                      ? 'tie'
                      : (left.sport?.win_pct ?? 0) >
                          (right.sport?.win_pct ?? 0)
                        ? 'left'
                        : 'right'
                  }
                />
                <SummaryRow
                  label="Jogos"
                  leftValue={String(left.sport?.win_matches ?? 0)}
                  rightValue={String(right.sport?.win_matches ?? 0)}
                  higher={
                    (left.sport?.win_matches ?? 0) ===
                    (right.sport?.win_matches ?? 0)
                      ? 'tie'
                      : (left.sport?.win_matches ?? 0) >
                          (right.sport?.win_matches ?? 0)
                        ? 'left'
                        : 'right'
                  }
                />
              </Card>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PlayerHead({ snap }: { snap: Snapshot }) {
  const ratingC = snap.overall > 0 ? ratingColor(snap.overall) : '#737373';
  return (
    <View style={styles.head}>
      <Avatar
        url={snap.profile.photo_url}
        name={snap.profile.name}
        size={64}
      />
      <Text style={styles.headName} numberOfLines={1}>
        {formatDisplayName(snap.profile)}
      </Text>
      <Text style={[styles.headOverall, { color: ratingC }]}>
        {snap.overall > 0 ? snap.overall : '—'}
      </Text>
    </View>
  );
}

function CompareRow({
  category,
  leftStats,
  rightStats,
}: {
  category: StatCategory;
  leftStats: AggregateStat[];
  rightStats: AggregateStat[];
}) {
  const l = leftStats.find((s) => s.category === category);
  const r = rightStats.find((s) => s.category === category);
  const lv = l?.value ?? 0;
  const rv = r?.value ?? 0;
  const lHas = (l?.votes ?? 0) > 0;
  const rHas = (r?.votes ?? 0) > 0;
  const max = Math.max(lv, rv, 1);
  const lPct = lHas ? Math.round((lv / max) * 100) : 0;
  const rPct = rHas ? Math.round((rv / max) * 100) : 0;
  const leftWins = lHas && rHas && lv > rv;
  const rightWins = lHas && rHas && rv > lv;
  return (
    <View style={styles.compareRow}>
      <Text
        style={[
          styles.compareValue,
          { color: leftWins ? '#C9A26B' : colors.text },
          !leftWins && rightWins ? styles.dim : null,
        ]}
      >
        {lHas ? lv : '—'}
      </Text>
      <View style={styles.compareBars}>
        <View style={styles.barRow}>
          <View style={styles.barLeftTrack}>
            <View
              style={[
                styles.barLeftFill,
                {
                  width: `${lPct}%`,
                  backgroundColor: leftWins ? '#C9A26B' : 'rgba(255,255,255,0.35)',
                },
              ]}
            />
          </View>
          <View style={styles.barRightTrack}>
            <View
              style={[
                styles.barRightFill,
                {
                  width: `${rPct}%`,
                  backgroundColor: rightWins ? '#C9A26B' : 'rgba(255,255,255,0.35)',
                },
              ]}
            />
          </View>
        </View>
        <Text style={styles.compareLabel}>{STAT_SHORT[category]} · {STAT_LABELS[category]}</Text>
      </View>
      <Text
        style={[
          styles.compareValue,
          { textAlign: 'right' },
          { color: rightWins ? '#C9A26B' : colors.text },
          !rightWins && leftWins ? styles.dim : null,
        ]}
      >
        {rHas ? rv : '—'}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  leftValue,
  rightValue,
  higher,
}: {
  label: string;
  leftValue: string;
  rightValue: string;
  higher: 'left' | 'right' | 'tie';
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryValue,
          { textAlign: 'left' },
          higher === 'left' && { color: '#C9A26B' },
          higher === 'right' && styles.dim,
        ]}
      >
        {leftValue}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          { textAlign: 'right' },
          higher === 'right' && { color: '#C9A26B' },
          higher === 'left' && styles.dim,
        ]}
      >
        {rightValue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muted: { color: colors.textMuted, textAlign: 'center' },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  head: { flex: 1, alignItems: 'center', gap: 8 },
  headName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  headOverall: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    marginTop: -4,
  },
  vs: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  section: { marginTop: 20 },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  compareValue: {
    width: 30,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dim: { color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  compareBars: { flex: 1, alignItems: 'center' },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 6,
  },
  barLeftTrack: {
    flex: 1,
    height: 6,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    overflow: 'hidden',
  },
  barLeftFill: { height: '100%' },
  barRightTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    overflow: 'hidden',
  },
  barRightFill: { height: '100%' },
  compareLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  summaryValue: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  summaryLabel: {
    flex: 1.2,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  tallyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tallyPct: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  tallyLabel: {
    flex: 1.2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tallyTrack: {
    flexDirection: 'row',
    height: 8,
    marginTop: 10,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tallySegA: { backgroundColor: '#C9A26B' },
  tallySegB: { backgroundColor: '#fbbf24' },
  tallySegD: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tallyDraw: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
  voteRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
});
