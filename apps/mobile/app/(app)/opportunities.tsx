import { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
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
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchMyTeams, positionShort, type TeamWithSport } from '@/lib/teams';
import {
  acceptOpenRequest,
  cancelOpenRequest,
  fetchOpenRequests,
  type OpenRequest,
} from '@/lib/open-requests';
import {
  acceptSubstituteRequest,
  cancelSubstituteRequest,
  fetchOpenSubstituteRequests,
  type SubstituteRequest,
} from '@/lib/substitute-requests';
import { formatRelativeMatchDate } from '@/lib/matches';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme';

type Tab = 'challenges' | 'subs';

export default function OpportunitiesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myTeams, setMyTeams] = useState<TeamWithSport[]>([]);
  const [challenges, setChallenges] = useState<OpenRequest[]>([]);
  const [subs, setSubs] = useState<SubstituteRequest[]>([]);
  const [tab, setTab] = useState<Tab>('challenges');
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (!p) return;
    setProfile(p);
    const [mine, ch, sb] = await Promise.all([
      fetchMyTeams(session.user.id),
      fetchOpenRequests(p.city),
      fetchOpenSubstituteRequests(p.city),
    ]);
    setMyTeams(mine);
    setChallenges(ch);
    setSubs(sb);
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

  async function runAcceptChallenge(req: OpenRequest, myTeamId: string) {
    setBusy(req.id);
    const myTeam = myCaptainTeams.find((t) => t.id === myTeamId);
    const r = await acceptOpenRequest(req.id, myTeamId, req.created_by, myTeam?.name);
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    Alert.alert('Desafio aceite!', 'O jogo está confirmado.', [
      { text: 'Ver jogo', onPress: () => router.push(`/(app)/matches/${r.match_id}`) },
    ]);
  }

  function handleAcceptChallenge(req: OpenRequest) {
    const eligible = myCaptainTeams.filter((t) => t.sport_id === req.sport_id);
    if (eligible.length === 0) {
      Alert.alert('Sem equipas elegíveis', 'Tens de ser capitão de uma equipa do mesmo desporto.');
      return;
    }
    if (eligible.length === 1) {
      runAcceptChallenge(req, eligible[0]!.id);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Aceitar com qual equipa?',
          options: [...eligible.map((t) => t.name), 'Cancelar'],
          cancelButtonIndex: eligible.length,
        },
        (idx) => {
          if (idx >= 0 && idx < eligible.length) {
            runAcceptChallenge(req, eligible[idx]!.id);
          }
        },
      );
    } else {
      Alert.alert('Aceitar desafio', 'Escolhe a equipa:', [
        ...eligible.map((t) => ({
          text: t.name,
          onPress: () => runAcceptChallenge(req, t.id),
        })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]);
    }
  }

  async function handleAcceptSub(sub: SubstituteRequest) {
    Alert.alert(
      'Aceitar como substituto?',
      `Entras em ${sub.team?.name ?? 'esta equipa'} para o jogo de ${sub.match ? formatRelativeMatchDate(sub.match.scheduled_at) : ''}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceitar',
          onPress: async () => {
            setBusy(sub.id);
            const r = await acceptSubstituteRequest(sub.id);
            setBusy(null);
            if (!r.ok) {
              Alert.alert('Erro', r.message);
              return;
            }
            Alert.alert('Aceite!', 'Estás no jogo.', [
              { text: 'Ver jogo', onPress: () => router.push(`/(app)/matches/${r.match_id}`) },
            ]);
          },
        },
      ],
    );
  }

  function handleCancelChallenge(req: OpenRequest) {
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
          setChallenges((prev) => prev.filter((x) => x.id !== req.id));
        },
      },
    ]);
  }

  function handleCancelSub(sub: SubstituteRequest) {
    Alert.alert('Cancelar pedido?', 'Sai da lista para os outros.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Cancelar',
        style: 'destructive',
        onPress: async () => {
          setBusy(sub.id);
          const r = await cancelSubstituteRequest(sub.id);
          setBusy(null);
          if (!r.ok) {
            Alert.alert('Erro', r.message);
            return;
          }
          setSubs((prev) => prev.filter((x) => x.id !== sub.id));
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Oportunidades abertas',
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
            <Skeleton width={180} height={28} />
            <Skeleton height={100} radius={16} style={{ marginTop: 12 }} />
            <Skeleton height={100} radius={16} />
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(300).springify()}>
              <Eyebrow>{profile?.city ?? ''}</Eyebrow>
              <Heading level={1} style={{ marginTop: 4 }}>
                Oportunidades abertas
              </Heading>
              <Text style={styles.intro}>
                Equipas à procura de adversário e jogos à procura de
                substitutos.
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(60).springify()}
              style={styles.tabRow}
            >
              <Pressable
                onPress={() => setTab('challenges')}
                style={[styles.tab, tab === 'challenges' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'challenges' && styles.tabTextActive,
                  ]}
                >
                  {`Desafios · ${challenges.length}`}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('subs')}
                style={[styles.tab, tab === 'subs' && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === 'subs' && styles.tabTextActive,
                  ]}
                >
                  {`🆘 Substitutos · ${subs.length}`}
                </Text>
              </Pressable>
            </Animated.View>

            {tab === 'challenges' ? (
              challenges.length === 0 ? (
                <Card style={{ marginTop: 16 }}>
                  <Heading level={3}>Sem desafios abertos</Heading>
                  <Text style={styles.empty}>
                    Quando algum capitão publicar disponibilidade, aparece aqui.
                  </Text>
                </Card>
              ) : (
                <View style={{ marginTop: 16 }}>
                  {challenges.map((req, i) => {
                    const own = myCaptainTeams.some((t) => t.id === req.team_id);
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
                            {req.team_matches && req.team_matches > 0 ? (
                              <Text style={styles.elo}>
                                {`${Math.round(req.team_win_pct ?? 0)}%`}
                              </Text>
                            ) : null}
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
                                onPress={() => handleCancelChallenge(req)}
                                full
                              />
                            ) : (
                              <Button
                                label="Aceitar desafio"
                                size="sm"
                                haptic="medium"
                                loading={busy === req.id}
                                onPress={() => handleAcceptChallenge(req)}
                                full
                              />
                            )}
                          </View>
                        </Card>
                      </Animated.View>
                    );
                  })}
                </View>
              )
            ) : subs.length === 0 ? (
              <Card style={{ marginTop: 16 }}>
                <Heading level={3}>Sem pedidos de substituto</Heading>
                <Text style={styles.empty}>
                  Quando alguma equipa precisar de jogadores, aparece aqui.
                </Text>
              </Card>
            ) : (
              <View style={{ marginTop: 16 }}>
                {subs.map((sub, i) => {
                  const own = sub.created_by === session?.user.id;
                  const posLabel = sub.position_needed
                    ? positionShort(sub.position_needed)
                    : 'Qualquer';
                  return (
                    <Animated.View
                      key={sub.id}
                      entering={FadeInDown.delay(80 + i * 30).springify()}
                    >
                      <Card style={{ marginTop: 12 }}>
                        <View style={styles.row}>
                          <Avatar
                            url={sub.team?.photo_url ?? null}
                            name={sub.team?.name ?? ''}
                            size={44}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.teamName}>
                              {sub.team?.name ?? 'Equipa'}
                              {own && (
                                <Text style={styles.youBadge}>{'  · TU'}</Text>
                              )}
                            </Text>
                            <Text style={styles.meta}>
                              {sub.match?.is_internal
                                ? 'Peladinha · '
                                : ''}
                              {sub.match
                                ? formatRelativeMatchDate(sub.match.scheduled_at)
                                : ''}
                            </Text>
                          </View>
                          <View style={styles.subBadge}>
                            <Text style={styles.subBadgeText}>{posLabel}</Text>
                          </View>
                        </View>
                        <Text style={styles.subSummary}>
                          {`Precisa de ${sub.count_needed - sub.count_filled} jogador${sub.count_needed - sub.count_filled === 1 ? '' : 'es'}`}
                          {sub.count_filled > 0
                            ? ` · ${sub.count_filled} já confirmado${sub.count_filled === 1 ? '' : 's'}`
                            : ''}
                        </Text>
                        <View style={styles.detailsRow}>
                          <Text style={styles.detailsText}>
                            {`📍 ${sub.match?.location_tbd ? 'A combinar' : (sub.match?.location_name ?? '—')}`}
                          </Text>
                        </View>
                        {sub.notes && (
                          <Text style={styles.notes}>{sub.notes}</Text>
                        )}
                        <View style={{ marginTop: 12 }}>
                          {own ? (
                            <Button
                              label="Cancelar pedido"
                              variant="ghost"
                              size="sm"
                              loading={busy === sub.id}
                              onPress={() => handleCancelSub(sub)}
                              full
                            />
                          ) : (
                            <Button
                              label="Aceitar como substituto"
                              size="sm"
                              haptic="medium"
                              loading={busy === sub.id}
                              onPress={() => handleAcceptSub(sub)}
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
  intro: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 19 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgElevated,
    borderRadius: 999,
    padding: 4,
    marginTop: 16,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: colors.brand },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#0E1812' },
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
  subBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  subBadgeText: { color: '#fbbf24', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  subSummary: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  detailsRow: { marginTop: 10 },
  detailsText: { color: colors.textMuted, fontSize: 13 },
  notes: {
    color: '#d4d4d4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
