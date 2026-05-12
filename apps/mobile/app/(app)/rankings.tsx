import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchActiveSports, type ActiveSport } from '@/lib/profile';
import {
  fetchTopPlayers,
  fetchTopTeams,
  type RankedPlayer,
  type RankedTeam,
} from '@/lib/rankings';
import { Avatar } from '@/components/Avatar';

type Tab = 'players' | 'teams';

export default function RankingsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sports, setSports] = useState<ActiveSport[]>([]);
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
    const s = await fetchActiveSports();
    setSports(s);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Ranking',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{profile?.city}</Text>

        <View style={styles.tabRow}>
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
        </View>

        {tab === 'players' ? (
          players.length === 0 ? (
            <Text style={styles.empty}>
              Sem jogadores com jogos suficientes para entrar no ranking.
            </Text>
          ) : (
            players.map((p, i) => (
              <Pressable
                key={p.user_id}
                style={styles.row}
                onPress={() => router.push(`/(app)/users/${p.user_id}`)}
              >
                <Text style={styles.rank}>{i + 1}</Text>
                <Avatar url={p.photo_url} name={p.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{p.name}</Text>
                  <Text style={styles.rowMeta}>
                    {p.matches_played} jogos
                  </Text>
                </View>
                <Text style={styles.rowElo}>{Math.round(p.elo)}</Text>
              </Pressable>
            ))
          )
        ) : teams.length === 0 ? (
          <Text style={styles.empty}>
            Ainda não há equipas suficientes na tua cidade.
          </Text>
        ) : (
          teams.map((t, i) => (
            <Pressable
              key={t.team_id}
              style={styles.row}
              onPress={() => router.push(`/(app)/teams/${t.team_id}`)}
            >
              <Text style={styles.rank}>{i + 1}</Text>
              <Avatar url={t.photo_url} name={t.name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{t.name}</Text>
                <Text style={styles.rowMeta}>
                  {t.member_count} membros
                </Text>
              </View>
              <Text style={styles.rowElo}>{Math.round(t.elo_avg)}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: '#ffffff' },
  tabText: { color: '#a3a3a3', fontWeight: '600' },
  tabTextActive: { color: '#000000' },
  empty: {
    color: '#737373',
    fontSize: 13,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 6,
    gap: 12,
  },
  rank: {
    color: '#737373',
    fontSize: 14,
    fontWeight: '700',
    width: 24,
    textAlign: 'center',
  },
  rowName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  rowMeta: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  rowElo: { color: '#fbbf24', fontSize: 16, fontWeight: '700' },
});
