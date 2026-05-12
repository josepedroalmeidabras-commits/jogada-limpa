import { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchActiveSports, type ActiveSport } from '@/lib/profile';
import { fetchMyTeams, type TeamWithSport } from '@/lib/teams';
import {
  fetchFreeAgents,
  inviteFreeAgent,
  type FreeAgent,
} from '@/lib/market';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme';

export default function MarketScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agents, setAgents] = useState<FreeAgent[]>([]);
  const [myTeams, setMyTeams] = useState<TeamWithSport[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (!p) return;
    setProfile(p);
    const sports: ActiveSport[] = await fetchActiveSports();
    const sport = sports[0];
    if (!sport) {
      setAgents([]);
      setLoading(false);
      return;
    }
    const teams = await fetchMyTeams(session.user.id);
    setMyTeams(teams);
    const a = await fetchFreeAgents(sport.id, [session.user.id]);
    setAgents(a);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
          headerTitle: 'Mercado livre',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <Eyebrow>{profile?.city ?? ''}</Eyebrow>
          <Heading level={1} style={{ marginTop: 4 }}>
            Jogadores livres
          </Heading>
          <Text style={styles.sub}>
            Jogadores que querem entrar numa equipa de Futebol 7. Se és
            capitão, adiciona à tua equipa em um toque.
          </Text>
        </Animated.View>

        {loading ? (
          <View style={{ gap: 8, marginTop: 16 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={84} radius={16} />
            ))}
          </View>
        ) : agents.length === 0 ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.emptyTitle}>Mercado vazio</Text>
            <Text style={styles.emptyBody}>
              Ninguém marcou disponibilidade. Quando alguém ativar no perfil,
              aparece aqui — e é o capitão que decide.
            </Text>
            <View style={{ marginTop: 12 }}>
              <Button
                label="Ativar disponibilidade no meu perfil"
                variant="secondary"
                onPress={() => router.push('/(app)/profile/edit')}
                full
              />
            </View>
          </Card>
        ) : (
          agents.map((a, i) => {
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
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  sub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    marginBottom: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
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
