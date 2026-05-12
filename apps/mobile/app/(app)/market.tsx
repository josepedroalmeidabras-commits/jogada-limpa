import { useCallback, useState } from 'react';
import { useMemo } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchActiveSports, type ActiveSport } from '@/lib/profile';
import { fetchMyTeams, type TeamWithSport } from '@/lib/teams';
import {
  fetchDiscoverableTeams,
  fetchFreeAgents,
  inviteFreeAgent,
  type DiscoverableTeam,
  type FreeAgent,
} from '@/lib/market';
import { fetchBlockedIds } from '@/lib/moderation';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme';

type Tab = 'players' | 'teams';

export default function MarketScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('players');
  const [agents, setAgents] = useState<FreeAgent[]>([]);
  const [teams, setTeams] = useState<DiscoverableTeam[]>([]);
  const [myTeams, setMyTeams] = useState<TeamWithSport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q),
    );
  }, [agents, query]);

  const filteredTeams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.city.toLowerCase().includes(q),
    );
  }, [teams, query]);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (!p) return;
    setProfile(p);
    const sports: ActiveSport[] = await fetchActiveSports();
    const sport = sports[0];
    if (!sport) {
      setAgents([]);
      setTeams([]);
      setLoading(false);
      return;
    }
    const mine = await fetchMyTeams(session.user.id);
    setMyTeams(mine);
    const [a, t, blocked] = await Promise.all([
      fetchFreeAgents(sport.id, [session.user.id]),
      fetchDiscoverableTeams(sport.id, p.city, mine.map((m) => m.id)),
      fetchBlockedIds(session.user.id),
    ]);
    setAgents(a.filter((agent) => !blocked.has(agent.user_id)));
    setTeams(t);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const myCaptainTeams = myTeams.filter(
    (t) => t.captain_id === session?.user.id,
  );

  async function handleInvite(agent: FreeAgent) {
    if (myCaptainTeams.length === 0) return;
    const eligibleTeams = myCaptainTeams.filter(
      (t) => t.sport_id === agent.sport_id,
    );
    if (eligibleTeams.length === 0) {
      Alert.alert('Sem equipas elegíveis', 'Cria uma equipa do mesmo desporto.');
      return;
    }

    const runInvite = async (teamId: string) => {
      setInviting(agent.user_id);
      const r = await inviteFreeAgent({
        team_id: teamId,
        user_id: agent.user_id,
      });
      setInviting(null);
      if (!r.ok) {
        Alert.alert('Erro', r.message);
        return;
      }
      setAgents((prev) => prev.filter((a) => a.user_id !== agent.user_id));
    };

    if (eligibleTeams.length === 1) {
      runInvite(eligibleTeams[0]!.id);
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Adicionar ${agent.name} a qual equipa?`,
          options: [...eligibleTeams.map((t) => t.name), 'Cancelar'],
          cancelButtonIndex: eligibleTeams.length,
        },
        (idx) => {
          if (idx >= 0 && idx < eligibleTeams.length) {
            runInvite(eligibleTeams[idx]!.id);
          }
        },
      );
    } else {
      Alert.alert(
        `Adicionar ${agent.name}`,
        'Escolhe a equipa:',
        [
          ...eligibleTeams.map((t) => ({
            text: t.name,
            onPress: () => runInvite(t.id),
          })),
          { text: 'Cancelar', style: 'cancel' as const },
        ],
      );
    }
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Mercado',
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
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <Eyebrow>{profile?.city ?? ''}</Eyebrow>
          <Heading level={1} style={{ marginTop: 4 }}>
            Mercado
          </Heading>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(40).springify()}
          style={styles.searchRow}
        >
          <Ionicons
            name="search"
            size={18}
            color={colors.textMuted}
            style={{ marginLeft: 14 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Procurar por nome ou cidade"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              style={{ paddingHorizontal: 14 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textDim} />
            </Pressable>
          )}
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
              {`Jogadores · ${filteredAgents.length}`}
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
              {`Equipas · ${filteredTeams.length}`}
            </Text>
          </Pressable>
        </Animated.View>

        {loading ? (
          <View style={{ gap: 8, marginTop: 16 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={84} radius={16} />
            ))}
          </View>
        ) : tab === 'players' ? (
          filteredAgents.length === 0 ? (
            <Card style={{ marginTop: 16 }}>
              <Text style={styles.emptyTitle}>Mercado vazio</Text>
              <Text style={styles.emptyBody}>
                Ninguém marcou disponibilidade. Activa no teu perfil para
                apareceres aqui.
              </Text>
              <View style={{ marginTop: 12 }}>
                <Button
                  label="Ativar disponibilidade"
                  variant="secondary"
                  onPress={() => router.push('/(app)/profile/edit')}
                  full
                />
              </View>
            </Card>
          ) : (
            filteredAgents.map((a, i) => {
              const isCaptain = myCaptainTeams.some(
                (t) => t.sport_id === a.sport_id,
              );
              return (
                <Animated.View
                  key={a.user_id}
                  entering={FadeInDown.delay(80 + i * 30).springify()}
                >
                  <Card style={{ marginTop: 8 }}>
                    <View style={styles.row}>
                      <Pressable
                        style={styles.left}
                        onPress={() => router.push(`/(app)/users/${a.user_id}`)}
                      >
                        <Avatar
                          url={a.photo_url}
                          name={a.name}
                          size={48}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{a.name}</Text>
                          <Text style={styles.meta}>
                            {`${a.city} · ${a.matches_played} jogos`}
                          </Text>
                        </View>
                      </Pressable>
                      <View style={styles.right}>
                        <Text style={styles.elo}>{Math.round(a.elo)}</Text>
                        {isCaptain && (
                          <Button
                            label="Adicionar"
                            size="sm"
                            loading={inviting === a.user_id}
                            onPress={() => handleInvite(a)}
                          />
                        )}
                      </View>
                    </View>
                  </Card>
                </Animated.View>
              );
            })
          )
        ) : filteredTeams.length === 0 ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.emptyTitle}>Sem equipas para descobrir</Text>
            <Text style={styles.emptyBody}>
              Ainda não há outras equipas activas em {profile?.city}. Quando
              alguém criar uma, aparece aqui.
            </Text>
          </Card>
        ) : (
          filteredTeams.map((t, i) => (
            <Animated.View
              key={t.team_id}
              entering={FadeInDown.delay(80 + i * 30).springify()}
            >
              <Card
                onPress={() => router.push(`/(app)/teams/${t.team_id}`)}
                style={{ marginTop: 8 }}
              >
                <View style={styles.row}>
                  <Avatar
                    url={t.photo_url}
                    name={t.name}
                    size={48}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{t.name}</Text>
                    <Text style={styles.meta}>
                      {`${t.city} · ${t.member_count} membros`}
                    </Text>
                  </View>
                  <Text style={styles.elo}>{Math.round(t.elo_avg)}</Text>
                </View>
              </Card>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: 20,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 15,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: 999,
    padding: 4,
    marginTop: 12,
    marginBottom: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#0E1812' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  right: { alignItems: 'flex-end', gap: 8 },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  elo: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
});
