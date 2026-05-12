import { useCallback, useState } from 'react';
import {
  Pressable,
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
  fetchTopPlayers,
  fetchTopTeams,
  type RankedPlayer,
  type RankedTeam,
} from '@/lib/rankings';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme';

type Tab = 'players' | 'teams';

export default function RankingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sportId, setSportId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('players');
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [teams, setTeams] = useState<RankedTeam[]>([]);
  const [loading, setLoading] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      if (!sportId || !profile) return;
      let cancelled = false;
      (async () => {
        const [pl, tm] = await Promise.all([
          fetchTopPlayers(sportId, profile.city, 20),
          fetchTopTeams(sportId, profile.city, 20),
        ]);
        if (cancelled) return;
        setPlayers(pl);
        setTeams(tm);
      })();
      return () => {
        cancelled = true;
      };
    }, [sportId, profile]),
  );

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
            </Animated.View>

            {tab === 'players' ? (
              players.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>
                    Sem jogadores com jogos suficientes para entrar no
                    ranking.
                  </Text>
                </Card>
              ) : (
                players.map((p, i) => (
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
            ) : teams.length === 0 ? (
              <Card style={{ marginTop: 8 }}>
                <Text style={styles.muted}>
                  Ainda não há equipas suficientes na tua cidade.
                </Text>
              </Card>
            ) : (
              teams.map((t, i) => (
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
            )}
          </>
        )}
      </ScrollView>
    </Screen>
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
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: '700', letterSpacing: 0.2 },
  tabTextActive: { color: '#0a0a0a' },
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
