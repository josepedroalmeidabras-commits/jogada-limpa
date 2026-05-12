import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile, fetchActiveSports, type ActiveSport } from '@/lib/profile';
import {
  fetchTopMvps,
  fetchTopPlayers,
  fetchTopTeams,
  type RankedMvp,
  type RankedPlayer,
  type RankedTeam,
} from '@/lib/rankings';
import { fetchTopScorers, type TopScorer } from '@/lib/season-stats';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme';

type Tab = 'players' | 'teams' | 'mvps' | 'scorers';
type PlayerSort = 'elo' | 'matches';
type TeamSort = 'elo' | 'members';

export default function RankingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sportId, setSportId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('players');
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [teams, setTeams] = useState<RankedTeam[]>([]);
  const [mvps, setMvps] = useState<RankedMvp[]>([]);
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [playerSort, setPlayerSort] = useState<PlayerSort>('elo');
  const [teamSort, setTeamSort] = useState<TeamSort>('elo');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const sortedPlayers = useMemo(() => {
    const arr = [...players];
    if (playerSort === 'matches') {
      arr.sort((a, b) => b.matches_played - a.matches_played);
    } else {
      arr.sort((a, b) => b.elo - a.elo);
    }
    return arr;
  }, [players, playerSort]);

  const sortedTeams = useMemo(() => {
    const arr = [...teams];
    if (teamSort === 'members') {
      arr.sort((a, b) => b.member_count - a.member_count);
    } else {
      arr.sort((a, b) => b.elo_avg - a.elo_avg);
    }
    return arr;
  }, [teams, teamSort]);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (!p) return;
    setProfile(p);
    const s: ActiveSport[] = await fetchActiveSports();
    const firstSport = s[0]?.id ?? null;
    setSportId((prev) => prev ?? firstSport);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const loadRankings = useCallback(async () => {
    if (!sportId || !profile) return;
    const [pl, tm, mv, sc] = await Promise.all([
      fetchTopPlayers(sportId, profile.city, 20),
      fetchTopTeams(sportId, profile.city, 20),
      fetchTopMvps(profile.city, 20),
      fetchTopScorers(profile.city, sportId, 20),
    ]);
    setPlayers(pl);
    setTeams(tm);
    setMvps(mv);
    setScorers(sc);
  }, [sportId, profile]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (cancelled) return;
        await loadRankings();
      })();
      return () => {
        cancelled = true;
      };
    }, [loadRankings]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadRankings()]);
    setRefreshing(false);
  }, [load, loadRankings]);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Ranking',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width={140} height={28} />
            <Skeleton height={44} radius={999} style={{ marginTop: 12 }} />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={60} radius={16} />
            ))}
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(300).springify()}>
              <Eyebrow>{profile?.city ?? ''}</Eyebrow>
              <Heading level={1} style={{ marginTop: 4 }}>
                Ranking
              </Heading>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(80).springify()}
              style={styles.tabRow}
            >
              <Pressable
                onPress={() => setTab('players')}
                style={[styles.tab, tab === 'players' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'players' && styles.tabTextActive,
                  ]}
                >
                  Jogadores
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('teams')}
                style={[styles.tab, tab === 'teams' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'teams' && styles.tabTextActive,
                  ]}
                >
                  Equipas
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('mvps')}
                style={[styles.tab, tab === 'mvps' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'mvps' && styles.tabTextActive,
                  ]}
                >
                  👑 MVPs
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('scorers')}
                style={[styles.tab, tab === 'scorers' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'scorers' && styles.tabTextActive,
                  ]}
                >
                  ⚽ Goleadores
                </Text>
              </Pressable>
            </Animated.View>

            {(tab === 'players' || tab === 'teams') && (
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Ordenar por</Text>
                {tab === 'players' ? (
                  <>
                    <SortChip
                      label="ELO"
                      active={playerSort === 'elo'}
                      onPress={() => setPlayerSort('elo')}
                    />
                    <SortChip
                      label="Jogos"
                      active={playerSort === 'matches'}
                      onPress={() => setPlayerSort('matches')}
                    />
                  </>
                ) : (
                  <>
                    <SortChip
                      label="ELO médio"
                      active={teamSort === 'elo'}
                      onPress={() => setTeamSort('elo')}
                    />
                    <SortChip
                      label="Membros"
                      active={teamSort === 'members'}
                      onPress={() => setTeamSort('members')}
                    />
                  </>
                )}
              </View>
            )}

            {tab === 'players' ? (
              sortedPlayers.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>
                    Sem jogadores com jogos suficientes para entrar no
                    ranking.
                  </Text>
                </Card>
              ) : (
                sortedPlayers.map((p, i) => (
                  <Animated.View
                    key={p.user_id}
                    entering={FadeInDown.delay(120 + i * 25).springify()}
                  >
                    <RankRow
                      rank={i + 1}
                      title={p.name}
                      subtitle={`${p.matches_played} jogos`}
                      photoUrl={p.photo_url}
                      elo={Math.round(p.elo)}
                      onPress={() => router.push(`/(app)/users/${p.user_id}`)}
                    />
                  </Animated.View>
                ))
              )
            ) : tab === 'teams' ? (
              sortedTeams.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>
                    Ainda não há equipas suficientes na tua cidade.
                  </Text>
                </Card>
              ) : (
                sortedTeams.map((t, i) => (
                  <Animated.View
                    key={t.team_id}
                    entering={FadeInDown.delay(120 + i * 25).springify()}
                  >
                    <RankRow
                      rank={i + 1}
                      title={t.name}
                      subtitle={`${t.member_count} membros`}
                      photoUrl={t.photo_url}
                      elo={Math.round(t.elo_avg)}
                      onPress={() => router.push(`/(app)/teams/${t.team_id}`)}
                    />
                  </Animated.View>
                ))
              )
            ) : tab === 'mvps' ? (
              mvps.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>
                    Ainda ninguém recebeu votos de MVP na tua cidade. Vai a um
                    jogo validado e vota.
                  </Text>
                </Card>
              ) : (
                mvps.map((m, i) => (
                  <Animated.View
                    key={m.user_id}
                    entering={FadeInDown.delay(120 + i * 25).springify()}
                  >
                    <RankRow
                      rank={i + 1}
                      title={m.name}
                      subtitle={`${m.mvp_votes} voto${m.mvp_votes === 1 ? '' : 's'}`}
                      photoUrl={m.photo_url}
                      elo={m.mvp_votes}
                      onPress={() => router.push(`/(app)/users/${m.user_id}`)}
                    />
                  </Animated.View>
                ))
              )
            ) : scorers.length === 0 ? (
              <Card style={{ marginTop: 8 }}>
                <Text style={styles.muted}>
                  Ainda ninguém marcou golos registados na tua cidade.
                </Text>
              </Card>
            ) : (
              scorers.map((s, i) => (
                <Animated.View
                  key={s.user_id}
                  entering={FadeInDown.delay(120 + i * 25).springify()}
                >
                  <RankRow
                    rank={i + 1}
                    title={s.name}
                    subtitle={`${s.goals} golo${s.goals === 1 ? '' : 's'} · ${s.assists} ass.`}
                    photoUrl={s.photo_url}
                    elo={s.goals}
                    onPress={() => router.push(`/(app)/users/${s.user_id}`)}
                  />
                </Animated.View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.sortChip, active && styles.sortChipActive]}
    >
      <Text
        style={[styles.sortChipText, active && styles.sortChipTextActive]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RankRow({
  rank,
  title,
  subtitle,
  photoUrl,
  elo,
  onPress,
}: {
  rank: number;
  title: string;
  subtitle: string;
  photoUrl: string | null;
  elo: number;
  onPress: () => void;
}) {
  const podium = rank <= 3;
  return (
    <Card onPress={onPress} style={{ marginTop: 8 }}>
      <View style={styles.row}>
        <Text
          style={[
            styles.rank,
            podium && styles.rankPodium,
            rank === 1 && { color: colors.brand },
          ]}
        >
          {rank}
        </Text>
        <Avatar url={photoUrl} name={title} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>{title}</Text>
          <Text style={styles.rowMeta}>{subtitle}</Text>
        </View>
        <Text style={styles.rowElo}>{elo}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: 999,
    padding: 4,
    marginTop: 20,
    marginBottom: 8,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  sortLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginRight: 4,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  sortChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  sortChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sortChipTextActive: { color: colors.brand },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.2 },
  tabTextActive: { color: '#0E1812' },
  muted: { color: colors.textDim, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: {
    color: colors.textDim,
    fontSize: 16,
    fontWeight: '800',
    width: 28,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  rankPodium: { color: colors.text },
  rowName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rowElo: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
});
