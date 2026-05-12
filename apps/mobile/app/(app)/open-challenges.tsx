import { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchMyTeams, type TeamWithSport } from '@/lib/teams';
import {
  acceptOpenRequest,
  cancelOpenRequest,
  fetchOpenRequests,
  type OpenRequest,
} from '@/lib/open-requests';
import { formatRelativeMatchDate } from '@/lib/matches';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme';

export default function OpenChallengesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myTeams, setMyTeams] = useState<TeamWithSport[]>([]);
  const [requests, setRequests] = useState<OpenRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (!p) return;
    setProfile(p);
    const [mine, list] = await Promise.all([
      fetchMyTeams(session.user.id),
      fetchOpenRequests(p.city),
    ]);
    setMyTeams(mine);
    setRequests(list);
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

  const myCaptainTeams = useMemo(
    () => myTeams.filter((t) => t.captain_id === session?.user.id),
    [myTeams, session],
  );

  function isMyOwn(req: OpenRequest): boolean {
    return myCaptainTeams.some((t) => t.id === req.team_id);
  }

  async function runAccept(req: OpenRequest, myTeamId: string) {
    setBusy(req.id);
    const myTeam = myCaptainTeams.find((t) => t.id === myTeamId);
    const r = await acceptOpenRequest(
      req.id,
      myTeamId,
      req.created_by,
      myTeam?.name,
    );
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    Alert.alert(
      'Desafio aceite!',
      'O jogo está confirmado. Vais para o detalhe.',
      [
        {
          text: 'Ver jogo',
          onPress: () => router.push(`/(app)/matches/${r.match_id}`),
        },
      ],
    );
  }

  function handleAccept(req: OpenRequest) {
    const eligible = myCaptainTeams.filter(
      (t) => t.sport_id === req.sport_id,
    );
    if (eligible.length === 0) {
      Alert.alert(
        'Sem equipas elegíveis',
        'Tens de ser capitão de uma equipa do mesmo desporto em ' +
          req.city +
          '.',
      );
      return;
    }
    if (eligible.length === 1) {
      runAccept(req, eligible[0]!.id);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Aceitar com qual equipa?`,
          options: [...eligible.map((t) => t.name), 'Cancelar'],
          cancelButtonIndex: eligible.length,
        },
        (idx) => {
          if (idx >= 0 && idx < eligible.length) {
            runAccept(req, eligible[idx]!.id);
          }
        },
      );
    } else {
      Alert.alert('Aceitar desafio', 'Escolhe a equipa:', [
        ...eligible.map((t) => ({
          text: t.name,
          onPress: () => runAccept(req, t.id),
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]);
    }
  }

  function handleCancel(req: OpenRequest) {
    Alert.alert('Cancelar este desafio?', 'Sai da lista para os outros.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar desafio',
        style: 'destructive',
        onPress: async () => {
          setBusy(req.id);
          const r = await cancelOpenRequest(req.id);
          setBusy(null);
          if (!r.ok) {
            Alert.alert('Erro', r.message);
            return;
          }
          setRequests((prev) => prev.filter((x) => x.id !== req.id));
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Desafios abertos',
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
            <Skeleton height={100} radius={16} style={{ marginTop: 12 }} />
            <Skeleton height={100} radius={16} />
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(300).springify()}>
              <Eyebrow>{profile?.city ?? ''}</Eyebrow>
              <Heading level={1} style={{ marginTop: 4 }}>
                Desafios abertos
              </Heading>
              <Text style={styles.intro}>
                Capitães à procura de adversário. Aceita um e o jogo fica
                imediatamente confirmado.
              </Text>
            </Animated.View>

            {myCaptainTeams.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(40).springify()}
                style={{ marginTop: 16 }}
              >
                <Card variant="subtle">
                  <Text style={styles.publishHint}>
                    {`És capitão de ${myCaptainTeams.length} equipa${myCaptainTeams.length === 1 ? '' : 's'}. Publica um desafio aberto a partir da página da equipa.`}
                  </Text>
                </Card>
              </Animated.View>
            )}

            {requests.length === 0 ? (
              <Card style={{ marginTop: 24 }}>
                <Heading level={3}>Sem desafios abertos</Heading>
                <Text style={styles.empty}>
                  Ainda ninguém publicou. Sê o primeiro — abre a página da tua
                  equipa e toca em "Publicar desafio aberto".
                </Text>
              </Card>
            ) : (
              <View style={{ marginTop: 16 }}>
                {requests.map((req, i) => {
                  const own = isMyOwn(req);
                  return (
                    <Animated.View
                      key={req.id}
                      entering={FadeInDown.delay(80 + i * 30).springify()}
                    >
                      <Card style={{ marginTop: 12 }}>
                        <View style={styles.row}>
                          <Avatar
                            url={req.team?.photo_url ?? null}
                            name={req.team?.name ?? ''}
                            size={44}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.teamName}>
                              {req.team?.name ?? 'Equipa'}
                              {own && (
                                <Text style={styles.youBadge}>{'  · TU'}</Text>
                              )}
                            </Text>
                            <Text style={styles.meta}>
                              {formatRelativeMatchDate(req.scheduled_at)}
                            </Text>
                          </View>
                          {req.team_elo_avg !== null && (
                            <Text style={styles.elo}>
                              {Math.round(req.team_elo_avg ?? 0)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.detailsRow}>
                          <Text style={styles.detailsText}>
                            {`📍 ${req.location_tbd ? 'A combinar' : (req.location_name ?? '—')}`}
                          </Text>
                        </View>
                        {req.notes && (
                          <Text style={styles.notes}>{req.notes}</Text>
                        )}
                        <View style={{ marginTop: 12 }}>
                          {own ? (
                            <Button
                              label="Cancelar desafio"
                              variant="ghost"
                              size="sm"
                              loading={busy === req.id}
                              onPress={() => handleCancel(req)}
                              full
                            />
                          ) : (
                            <Button
                              label="Aceitar desafio"
                              size="sm"
                              haptic="medium"
                              loading={busy === req.id}
                              onPress={() => handleAccept(req)}
                              full
                            />
                          )}
                        </View>
                      </Card>
                    </Animated.View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  intro: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 12,
    lineHeight: 19,
  },
  publishHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  youBadge: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  elo: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  detailsRow: { marginTop: 12 },
  detailsText: { color: colors.textMuted, fontSize: 13, letterSpacing: -0.1 },
  notes: {
    color: '#d4d4d4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
