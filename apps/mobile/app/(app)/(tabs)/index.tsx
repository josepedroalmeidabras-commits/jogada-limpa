import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { supabase } from '@/lib/supabase';
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchMyTeams, isTeamLeader, type TeamWithSport } from '@/lib/teams';
import { fetchPreferredPosition } from '@/lib/reviews';
import {
  categoriesForPosition,
  fetchPendingStatVoteTeammates,
  fetchPlayerStats,
  overallRating,
  ratingColor,
  STAT_ICONS,
  STAT_LABELS,
  totalVotes,
  type AggregateStat,
  type PendingTeammate,
} from '@/lib/player-stats';
import {
  fetchCityActivity,
  fetchNextMatchForUser,
  fetchPendingChallengesForUser,
  fetchPendingReviewsForUser,
  formatMatchDate,
  formatRelativeMatchDate,
  type CityActivity,
  type MatchSummary,
  type PendingChallenge,
  type PendingReview,
} from '@/lib/matches';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Avatar } from '@/components/Avatar';
import { PlayerStatsCard } from '@/components/PlayerStatsCard';
import { WelcomeTutorial } from '@/components/WelcomeTutorial';
import { MatchKindSheet } from '@/components/MatchKindSheet';
import { ConfirmSheet, type ConfirmOption } from '@/components/ConfirmSheet';
import { useToast } from '@/components/Toast';

type ConfirmConfig = {
  title: string;
  subtitle?: string;
  options: ConfirmOption[];
};
import { MatchResultRow } from '@/components/MatchResultRow';
import { fetchUnreadCount } from '@/lib/notifications';
import { fetchMvpOfWeek } from '@/lib/mvp';
import { fetchCityPulse, type CityPulse } from '@/lib/city';
import {
  computeMonthlyStats,
  computeWinStreak,
  fetchUserMatchHistory,
  type MatchHistoryEntry,
  type MonthlyStats,
} from '@/lib/history';
import {
  fetchPlayerMonthStats,
  type MonthStats,
} from '@/lib/season-stats';
import {
  fetchFriends,
  fetchFriendsRecentMatches,
  fetchIncomingRequests,
  fetchPendingFriendsCount,
  type FriendMatchEvent,
  type PendingRequest,
} from '@/lib/friends';
import {
  fetchPendingPeladinhaInvites,
  type PendingPeladinhaInvite,
} from '@/lib/internal-match';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<TeamWithSport[]>([]);
  const [challenges, setChallenges] = useState<PendingChallenge[]>([]);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [activity, setActivity] = useState<CityActivity[]>([]);
  const [unread, setUnread] = useState(0);
  const [monthly, setMonthly] = useState<MonthlyStats | null>(null);
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendMatchEvent[]>([]);
  const [nextMatch, setNextMatch] = useState<MatchSummary | null>(null);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [peladinhas, setPeladinhas] = useState<PendingPeladinhaInvite[]>([]);
  const [playerStats, setPlayerStats] = useState<AggregateStat[]>([]);
  const [pendingVotes, setPendingVotes] = useState<PendingTeammate[]>([]);
  const [mvpWeek, setMvpWeek] = useState<{
    user_id: string;
    name: string;
    photo_url: string | null;
    votes: number;
  } | null>(null);
  const [cityPulse, setCityPulse] = useState<CityPulse | null>(null);
  const [myPosition, setMyPosition] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState<{
    items: { key: string; label: string; done: boolean }[];
    percent: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seen = await AsyncStorage.getItem('s7vn:welcome_seen');
      if (!cancelled && !seen) setShowWelcome(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissWelcome = useCallback(async () => {
    setShowWelcome(false);
    await AsyncStorage.setItem('s7vn:welcome_seen', '1');
  }, []);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (!p) {
      router.replace('/(app)/onboarding');
      return;
    }
    if (p.deleted_at) {
      await supabase.auth.signOut();
      router.replace('/(auth)/login');
      return;
    }
    setProfile(p);
    const position = await fetchPreferredPosition(session.user.id);
    const [myTeams, ch, rv, act, u, hist, fa, inc, friends, myStats, nxt, pel] = await Promise.all([
      fetchMyTeams(session.user.id),
      fetchPendingChallengesForUser(session.user.id),
      fetchPendingReviewsForUser(session.user.id),
      fetchCityActivity(p.city, 5),
      fetchUnreadCount(session.user.id),
      fetchUserMatchHistory(session.user.id, 50),
      fetchFriendsRecentMatches(6),
      fetchIncomingRequests(),
      fetchFriends(),
      fetchPlayerStats(session.user.id, position),
      fetchNextMatchForUser(session.user.id),
      fetchPendingPeladinhaInvites(),
    ]);
    setMyPosition(position);
    setPlayerStats(myStats);
    setPendingVotes(await fetchPendingStatVoteTeammates(6));
    if (p.city) {
      const [mw, cp] = await Promise.all([
        fetchMvpOfWeek(p.city),
        fetchCityPulse(p.city),
      ]);
      setMvpWeek(mw);
      setCityPulse(cp);
    }
    setTeams(myTeams);
    setChallenges(ch);
    setReviews(rv);
    setActivity(act);
    setUnread(u);
    setMonthly(computeMonthlyStats(hist));
    const now = new Date();
    const ms = await fetchPlayerMonthStats(
      session.user.id,
      now.getFullYear(),
      now.getMonth() + 1,
    );
    setMonthStats(ms);
    setHistory(hist);
    setFriendsActivity(fa);
    setNextMatch(nxt);
    setIncoming(inc);
    setPeladinhas(pel);

    const items = [
      { key: 'photo', label: 'Foto de perfil', done: Boolean(p.photo_url) },
      { key: 'bio', label: 'Bio preenchida', done: Boolean(p.bio && p.bio.length > 0) },
      { key: 'team', label: 'Pelo menos 1 equipa', done: myTeams.length > 0 },
      {
        key: 'stats',
        label: 'Sugeriste os teus atributos',
        done: myStats.some((s) => s.votes > 0),
      },
      { key: 'friend', label: 'Pelo menos 1 amigo', done: friends.length > 0 },
    ];
    const doneCount = items.filter((it) => it.done).length;
    setCompleteness({
      items,
      percent: Math.round((doneCount / items.length) * 100),
    });
    setLoading(false);
  }, [session, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const myLeaderTeams = teams.filter((t) =>
    isTeamLeader(t, session?.user.id),
  );
  const isLeader = myLeaderTeams.length > 0;
  const primaryTeam = myLeaderTeams[0] ?? teams[0] ?? null;

  const [matchKindOpen, setMatchKindOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const { showToast } = useToast();

  const handlePrimaryAction = useCallback(() => {
    if (myLeaderTeams.length === 0) {
      router.push('/(app)/teams/new');
      return;
    }
    setMatchKindOpen(true);
  }, [myLeaderTeams, router]);

  const handleMatchKindPick = useCallback(
    (kind: 'match' | 'internal' | 'open') => {
      setMatchKindOpen(false);
      const go = (teamId: string) => {
        if (kind === 'match')
          router.push(`/(app)/teams/${teamId}/match/new`);
        else if (kind === 'internal')
          router.push(`/(app)/teams/${teamId}/internal/new`);
        else router.push(`/(app)/teams/${teamId}/open-request`);
      };
      if (myLeaderTeams.length === 1) {
        go(myLeaderTeams[0]!.id);
        return;
      }
      setConfirm({
        title: 'Para que equipa?',
        subtitle: 'Escolhe a equipa que vai marcar este jogo.',
        options: myLeaderTeams.map((t) => ({
          label: t.name,
          icon: 'shield' as const,
          onPress: () => {
            setConfirm(null);
            go(t.id);
          },
        })),
      });
    },
    [myLeaderTeams, router],
  );

  return (
    <Screen>
      <WelcomeTutorial visible={showWelcome} onClose={dismissWelcome} />
      <MatchKindSheet
        visible={matchKindOpen}
        onClose={() => setMatchKindOpen(false)}
        onSelect={handleMatchKindPick}
      />
      <ConfirmSheet
        visible={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        subtitle={confirm?.subtitle}
        options={confirm?.options ?? []}
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
          <HomeSkeleton />
        ) : (
          <>
            <Animated.View
              entering={FadeInDown.duration(300).springify()}
              style={styles.header}
            >
              {primaryTeam ? (
                <Pressable
                  style={[styles.teamBadge, { flex: 1 }]}
                  onPress={() =>
                    router.push(`/(app)/teams/${primaryTeam.id}`)
                  }
                >
                  <Avatar
                    url={primaryTeam.photo_url}
                    name={primaryTeam.name}
                    size={28}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamBadgeName} numberOfLines={1}>
                      {primaryTeam.name}
                    </Text>
                    <Text style={styles.teamBadgeRole}>
                      {(
                        (primaryTeam.captain_id === session?.user.id
                          ? 'Capitão'
                          : session?.user.id &&
                              primaryTeam.sub_captain_ids.includes(
                                session.user.id,
                              )
                            ? 'Sub-capitão'
                            : 'Jogador') +
                        (teams.length > 1 ? ` · +${teams.length - 1}` : '')
                      ).toLocaleUpperCase('pt-PT')}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.teamBadge, { flex: 1 }]}
                  onPress={() => router.push('/(app)/teams/new')}
                >
                  <View style={styles.teamBadgePlaceholderAvatar}>
                    <Text style={styles.teamBadgePlaceholderText}>+</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamBadgeName} numberOfLines={1}>
                      Criar equipa
                    </Text>
                    <Text style={styles.teamBadgeRole}>
                      {(profile?.city ?? 'Coimbra').toLocaleUpperCase('pt-PT')}
                    </Text>
                  </View>
                </Pressable>
              )}
              <Pressable
                style={styles.bell}
                onPress={() => router.push('/(app)/search')}
              >
                <Ionicons name="search" size={22} color={colors.text} />
              </Pressable>
              <Pressable
                style={styles.bell}
                onPress={() => router.push('/(app)/notifications')}
              >
                <Ionicons
                  name={unread > 0 ? 'notifications' : 'notifications-outline'}
                  size={22}
                  color={unread > 0 ? colors.brand : colors.text}
                />
                {unread > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unread > 9 ? '9+' : String(unread)}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() => router.push('/(app)/(tabs)/profile')}
                hitSlop={8}
              >
                <Avatar
                  url={profile?.photo_url}
                  name={profile?.name}
                  size={44}
                />
              </Pressable>
            </Animated.View>

            {mvpWeek && (
              <Animated.View entering={FadeInDown.delay(30).springify()}>
                <Pressable
                  style={styles.mvpChip}
                  onPress={() => router.push(`/(app)/users/${mvpWeek.user_id}`)}
                >
                  <View style={styles.mvpIcon}>
                    <Ionicons name="trophy" size={14} color={colors.goldDeep} />
                  </View>
                  <Avatar
                    url={mvpWeek.photo_url}
                    name={mvpWeek.name}
                    size={24}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mvpName} numberOfLines={1}>
                      {mvpWeek.name}
                    </Text>
                    <Text style={styles.mvpMeta}>
                      {`MVP da semana · ${mvpWeek.votes} voto${mvpWeek.votes === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                </Pressable>
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(40).springify()}
              style={primaryTeam || mvpWeek ? { marginTop: 12 } : undefined}
            >
              <Card
                variant={nextMatch ? 'hero' : 'subtle'}
                onPress={
                  nextMatch
                    ? () => router.push(`/(app)/matches/${nextMatch.id}`)
                    : undefined
                }
              >
                {nextMatch ? (
                  (() => {
                    const diff =
                      new Date(nextMatch.scheduled_at).getTime() - Date.now();
                    const minsAhead = Math.floor(diff / 60_000);
                    let chip: { label: string; tone: 'live' | 'warn' | null } =
                      { label: '', tone: null };
                    if (diff <= 0 && diff > -4 * 60 * 60 * 1000) {
                      chip = { label: 'AO VIVO', tone: 'live' };
                    } else if (minsAhead >= 0 && minsAhead < 60) {
                      chip = {
                        label: `EM ${minsAhead || 1} MIN`,
                        tone: 'warn',
                      };
                    } else if (minsAhead < 120) {
                      const h = Math.floor(minsAhead / 60);
                      const m = minsAhead % 60;
                      chip = {
                        label: m === 0 ? `EM ${h}H` : `EM ${h}H ${m}MIN`,
                        tone: 'warn',
                      };
                    }
                    return (
                      <>
                        <View style={styles.statusHead}>
                          <Eyebrow>Próximo jogo</Eyebrow>
                          {chip.label ? (
                            <View
                              style={[
                                styles.statusChip,
                                chip.tone === 'live' && styles.statusChipLive,
                                chip.tone === 'warn' && styles.statusChipWarn,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusChipText,
                                  chip.tone === 'live' && {
                                    color: '#0E1812',
                                  },
                                ]}
                              >
                                {chip.label}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.nextMatchDate}>
                              {formatRelativeMatchDate(nextMatch.scheduled_at).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.nextMatchTeams}>
                          <View style={styles.nextMatchTeam}>
                            <Avatar
                              url={nextMatch.side_a.photo_url}
                              name={nextMatch.side_a.name}
                              size={44}
                            />
                            <Text
                              style={styles.nextMatchTeamName}
                              numberOfLines={1}
                            >
                              {nextMatch.is_internal && nextMatch.side_a_label
                                ? nextMatch.side_a_label
                                : nextMatch.side_a.name}
                            </Text>
                          </View>
                          <Text style={styles.nextMatchVs}>vs</Text>
                          <View style={styles.nextMatchTeam}>
                            <Avatar
                              url={nextMatch.side_b.photo_url}
                              name={nextMatch.side_b.name}
                              size={44}
                            />
                            <Text
                              style={styles.nextMatchTeamName}
                              numberOfLines={1}
                            >
                              {nextMatch.is_internal && nextMatch.side_b_label
                                ? nextMatch.side_b_label
                                : nextMatch.side_b.name}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.statusMeta} numberOfLines={2}>
                          {nextMatch.location_tbd
                            ? 'Local a combinar'
                            : (nextMatch.location_name ?? '—')}
                        </Text>
                      </>
                    );
                  })()
                ) : (
                  <Text style={styles.statusMuted}>
                    {teams.length === 0
                      ? 'Ainda sem equipa. Cria a tua para começar.'
                      : 'Sem jogos marcados.'}
                  </Text>
                )}
              </Card>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(60).springify()}
              style={styles.actions}
            >
              {isLeader ? (
                <Button
                  label="Marcar jogo"
                  size="lg"
                  full
                  haptic="medium"
                  onPress={handlePrimaryAction}
                />
              ) : (
                <Button
                  label={
                    teams.length === 0 ? 'Criar equipa' : 'Entrar com código'
                  }
                  size="lg"
                  full
                  haptic="medium"
                  onPress={() =>
                    router.push(
                      teams.length === 0
                        ? '/(app)/teams/new'
                        : '/(app)/teams/join',
                    )
                  }
                />
              )}
              <Button
                label="Oportunidades abertas"
                variant="secondary"
                size="lg"
                full
                onPress={() => router.push('/(app)/opportunities')}
              />
              {isLeader && (
                <Button
                  label="Mercado livre"
                  variant="secondary"
                  size="lg"
                  full
                  onPress={() => router.push('/(app)/market')}
                />
              )}
              {isLeader && (
                <Button
                  label="Entrar com código"
                  variant="ghost"
                  size="md"
                  full
                  onPress={() => router.push('/(app)/teams/join')}
                />
              )}
            </Animated.View>

            {incoming.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(65).springify()}
                style={{ marginTop: completeness && completeness.percent < 100 ? 12 : 0 }}
              >
                <Card
                  variant="warning"
                  onPress={() => router.push('/(app)/profile/friends')}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.requestsIcon}>
                      <Ionicons name="person-add" size={18} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>
                        {incoming.length === 1
                          ? `${incoming[0]!.name.split(' ')[0]} quer ser teu amigo`
                          : `${incoming.length} novos pedidos de amizade`}
                      </Text>
                      <Text style={styles.cardMeta}>
                        Tocar para responder
                      </Text>
                    </View>
                    <Text style={styles.arrow}>›</Text>
                  </View>
                </Card>
              </Animated.View>
            )}

            {peladinhas.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(68).springify()}
                style={styles.section}
              >
                <Eyebrow>{`Peladinhas · ${peladinhas.length} por confirmar`}</Eyebrow>
                {peladinhas.slice(0, 3).map((p, i) => (
                  <Animated.View
                    key={p.match_id}
                    entering={FadeInDown.delay(100 + i * 40).springify()}
                  >
                    <Card
                      onPress={() => router.push(`/(app)/matches/${p.match_id}`)}
                      style={{ marginTop: 8 }}
                    >
                      <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardName}>{p.team_name}</Text>
                          <Text style={styles.cardMeta}>
                            {formatRelativeMatchDate(p.scheduled_at)} ·{' '}
                            {p.location_tbd
                              ? 'A combinar'
                              : (p.location_name ?? '—')}
                          </Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                      </View>
                    </Card>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            {pendingVotes.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(69).springify()}
                style={styles.section}
              >
                <Eyebrow>{`Vota nos colegas · ${pendingVotes.length}`}</Eyebrow>
                <Card variant="subtle" style={{ marginTop: 8 }}>
                  <Text style={styles.statsHint}>
                    Tens colegas de equipa que ainda não avaliaste. Cada voto
                    afina os atributos no perfil deles.
                  </Text>
                  <View style={styles.pendingRow}>
                    {pendingVotes.slice(0, 6).map((t) => (
                      <Pressable
                        key={t.user_id}
                        onPress={() =>
                          router.push(`/(app)/users/${t.user_id}/stats-vote`)
                        }
                        style={styles.pendingChip}
                      >
                        <Avatar
                          url={t.photo_url}
                          name={t.name}
                          size={36}
                        />
                        <Text style={styles.pendingChipName} numberOfLines={1}>
                          {t.name.split(' ')[0]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </Animated.View>
            )}

            {monthStats && monthStats.matches_played > 0 && (
              <Animated.View entering={FadeInDown.delay(70).springify()}>
                <Card variant="subtle">
                  <Eyebrow>Este mês</Eyebrow>
                  <View style={styles.monthRow}>
                    <View style={styles.monthCell}>
                      <Text style={styles.monthValue}>
                        {monthStats.matches_played}
                      </Text>
                      <Text style={styles.monthLabel}>
                        {monthStats.matches_played === 1 ? 'jogo' : 'jogos'}
                      </Text>
                    </View>
                    <View style={styles.monthCell}>
                      <Text
                        style={[
                          styles.monthValue,
                          { color: colors.warning },
                        ]}
                      >
                        {monthStats.goals}
                      </Text>
                      <Text style={styles.monthLabel}>Golos</Text>
                    </View>
                    <View style={styles.monthCell}>
                      <Text
                        style={[
                          styles.monthValue,
                          { color: colors.success },
                        ]}
                      >
                        {monthStats.assists}
                      </Text>
                      <Text style={styles.monthLabel}>Assist.</Text>
                    </View>
                    <View style={styles.monthCell}>
                      <Text
                        style={[
                          styles.monthValue,
                          { color: colors.goldDeep },
                        ]}
                      >
                        {monthStats.mvps}
                      </Text>
                      <Text style={styles.monthLabel}>MVPs</Text>
                    </View>
                  </View>
                  <View style={styles.monthRecord}>
                    <Text style={styles.monthRecordText}>
                      {`${monthStats.wins}V · ${monthStats.draws}E · ${monthStats.losses}D`}
                    </Text>
                  </View>
                </Card>
              </Animated.View>
            )}

            {challenges.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(80).springify()}
                style={styles.section}
              >
                <Eyebrow>
                  {`Convites · ${challenges.length}`}
                </Eyebrow>
                {challenges.map((c, i) => (
                  <Animated.View
                    key={c.match_id}
                    entering={FadeInDown.delay(120 + i * 40).springify()}
                  >
                    <Card
                      variant="warning"
                      onPress={() =>
                        router.push(`/(app)/matches/${c.match_id}`)
                      }
                      style={{ marginTop: 8 }}
                    >
                      <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardName}>
                            {c.my_side === 'B'
                              ? `Desafio de ${c.opponent_team_name}`
                              : `Aguardas resposta de ${c.opponent_team_name}`}
                          </Text>
                          <Text style={styles.cardMeta}>
                            {formatRelativeMatchDate(c.scheduled_at)} ·{' '}
                            {c.location_tbd
                              ? 'A combinar'
                              : (c.location_name ?? '—')}
                          </Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                      </View>
                    </Card>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            {reviews.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(140).springify()}
                style={styles.section}
              >
                <Eyebrow>{`Avaliações · ${reviews.length}`}</Eyebrow>
                {reviews.map((r, i) => (
                  <Animated.View
                    key={r.match_id}
                    entering={FadeInDown.delay(180 + i * 40).springify()}
                  >
                    <Card
                      variant="success"
                      onPress={() =>
                        router.push(`/(app)/matches/${r.match_id}/review`)
                      }
                      style={{ marginTop: 8 }}
                    >
                      <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardName}>
                            {`${r.side_a_name} vs ${r.side_b_name}`}
                          </Text>
                          <Text style={styles.cardMeta}>
                            {`${r.others_to_review} jogador(es) para avaliar`}
                          </Text>
                        </View>
                        <Text style={styles.arrow}>›</Text>
                      </View>
                    </Card>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(280).springify()}
              style={styles.section}
            >
              <Eyebrow>Os teus amigos jogaram</Eyebrow>
              {friendsActivity.length > 0 ? (
                friendsActivity.map((m, i) => (
                  <Animated.View
                    key={m.match_id}
                    entering={FadeInDown.delay(320 + i * 30).springify()}
                    style={{ marginTop: 8 }}
                  >
                    <View style={styles.feedCardOuter}>
                      <Pressable
                        onPress={() => router.push(`/(app)/users/${m.friend_id}`)}
                        style={styles.friendChip}
                      >
                        <Avatar
                          url={m.friend_photo}
                          name={m.friend_name}
                          size={22}
                        />
                        <Text style={styles.friendChipName} numberOfLines={1}>
                          {m.friend_name}
                        </Text>
                      </Pressable>
                      <MatchResultRow
                        scheduledAt={m.scheduled_at}
                        isInternal={m.is_internal}
                        status="validated"
                        sideAName={m.side_a_name}
                        sideBName={m.side_b_name}
                        sideAPhoto={m.side_a_photo}
                        sideBPhoto={m.side_b_photo}
                        scoreA={m.final_score_a}
                        scoreB={m.final_score_b}
                        mySide={m.friend_side}
                        myGoals={m.friend_goals}
                        myAssists={m.friend_assists}
                        onPress={() => router.push(`/(app)/matches/${m.match_id}`)}
                      />
                    </View>
                  </Animated.View>
                ))
              ) : (
                <Card
                  variant="subtle"
                  style={{ marginTop: 8 }}
                  onPress={() => router.push('/(app)/profile/find-friends')}
                >
                  <View style={styles.emptyRow}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="people-outline" size={22} color={colors.goldDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.emptyTitle}>
                        Ainda não tens amigos no S7VN
                      </Text>
                      <Text style={styles.emptyBody}>
                        Encontra-os e vê aqui o que jogam.
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.brand} />
                  </View>
                </Card>
              )}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(360).springify()}
              style={styles.section}
            >
              <Eyebrow>{`Atividade em ${profile?.city ?? ''}`}</Eyebrow>
              {cityPulse &&
                cityPulse.matches_7d + cityPulse.active_teams > 0 && (
                  <Text style={styles.cityPulseLine}>
                    {`${cityPulse.matches_7d} jogo${cityPulse.matches_7d === 1 ? '' : 's'} esta semana · ${cityPulse.active_teams} equipa${cityPulse.active_teams === 1 ? '' : 's'} · ${cityPulse.active_players} jogador${cityPulse.active_players === 1 ? '' : 'es'}`}
                  </Text>
                )}
              {activity.length > 0 ? (
                activity.map((m, i) => (
                  <Animated.View
                    key={m.match_id}
                    entering={FadeInDown.delay(340 + i * 30).springify()}
                    style={{ marginTop: 8 }}
                  >
                    <View style={styles.feedCardOuter}>
                      <MatchResultRow
                        scheduledAt={m.scheduled_at}
                        isInternal={m.is_internal}
                        status="validated"
                        sideAName={m.side_a_name}
                        sideBName={m.side_b_name}
                        sideAPhoto={m.side_a_photo}
                        sideBPhoto={m.side_b_photo}
                        scoreA={m.final_score_a}
                        scoreB={m.final_score_b}
                        onPress={() => router.push(`/(app)/matches/${m.match_id}`)}
                      />
                    </View>
                  </Animated.View>
                ))
              ) : (
                <Card
                  variant="subtle"
                  style={{ marginTop: 8 }}
                  onPress={
                    isLeader
                      ? handlePrimaryAction
                      : () => router.push('/(app)/search')
                  }
                >
                  <View style={styles.emptyRow}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="flame-outline" size={22} color={colors.goldDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.emptyTitle}>
                        {`Sê dos primeiros em ${profile?.city ?? 'Coimbra'}`}
                      </Text>
                      <Text style={styles.emptyBody}>
                        {isLeader
                          ? 'Marca o primeiro jogo e aparece aqui para os teus vizinhos verem.'
                          : 'Procura equipas e jogadores e ajuda a animar a cena local.'}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={colors.brand} />
                  </View>
                </Card>
              )}
            </Animated.View>

            {completeness && completeness.percent < 100 && (
              <Animated.View
                entering={FadeInDown.delay(365).springify()}
                style={styles.section}
              >
                <Card variant="subtle">
                  <View style={styles.completeHeader}>
                    <Eyebrow>Completa o teu perfil</Eyebrow>
                    <Text style={styles.completePercent}>
                      {`${completeness.percent}%`}
                    </Text>
                  </View>
                  <View style={styles.completeTrack}>
                    <View
                      style={[
                        styles.completeFill,
                        { width: `${completeness.percent}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.completeList}>
                    {completeness.items.map((it) => {
                      const path: string =
                        it.key === 'team'
                          ? '/(app)/teams/new'
                          : it.key === 'stats'
                            ? `/(app)/users/${session?.user.id}/stats-vote`
                            : it.key === 'friend'
                              ? '/(app)/search'
                              : '/(app)/profile/edit';
                      return (
                        <Pressable
                          key={it.key}
                          style={styles.completeItem}
                          onPress={() =>
                            !it.done && router.push(path as any)
                          }
                          disabled={it.done}
                        >
                          <Ionicons
                            name={
                              it.done
                                ? 'checkmark-circle'
                                : 'ellipse-outline'
                            }
                            size={18}
                            color={it.done ? colors.brand : colors.textDim}
                          />
                          <Text
                            style={[
                              styles.completeLabel,
                              it.done && styles.completeLabelDone,
                            ]}
                          >
                            {it.label}
                          </Text>
                          {!it.done && (
                            <Text style={styles.completeArrow}>›</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </Card>
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(370).springify()}
              style={styles.section}
            >
              <PlayerStatsCard
                stats={playerStats}
                overall={overallRating(playerStats)}
                totalVotes={totalVotes(playerStats)}
              />
              {totalVotes(playerStats) === 0 && (
                <Text style={styles.statsHint}>
                  Pede aos teus colegas para votarem nos teus atributos para
                  veres a tua classificação aqui.
                </Text>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function MatchFeedRow({
  sideAName,
  sideBName,
  sideAPhoto,
  sideBPhoto,
  scoreA,
  scoreB,
  meta,
  isInternal = false,
}: {
  sideAName: string;
  sideBName: string;
  sideAPhoto: string | null;
  sideBPhoto: string | null;
  scoreA: number | null;
  scoreB: number | null;
  meta: string;
  isInternal?: boolean;
}) {
  const aWon = scoreA !== null && scoreB !== null && scoreA > scoreB;
  const bWon = scoreA !== null && scoreB !== null && scoreB > scoreA;
  const railColor = isInternal ? colors.goldDeep : colors.compete;
  return (
    <View
      style={[
        styles.feedRowWrap,
        { borderLeftColor: railColor },
      ]}
    >
      <View style={styles.feedDateCol}>
        <Text style={styles.feedDate}>{meta}</Text>
        <View
          style={[
            styles.feedKindChip,
            {
              backgroundColor: isInternal
                ? colors.brandSoft
                : colors.competeSoft,
              borderColor: isInternal ? colors.goldDim : colors.competeDim,
            },
          ]}
        >
          <Text
            style={[
              styles.feedKindChipText,
              { color: isInternal ? colors.goldDeep : colors.compete },
            ]}
          >
            {isInternal ? 'PELADINHA' : 'AMIGÁVEL'}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.feedTeamLine}>
          <Avatar url={sideAPhoto} name={sideAName} size={20} />
          <Text
            style={[
              styles.feedTeamName,
              !aWon && scoreA !== null && styles.feedTeamNameDim,
            ]}
            numberOfLines={1}
          >
            {sideAName}
          </Text>
          <Text
            style={[
              styles.feedScore,
              !aWon && scoreA !== null && styles.feedScoreDim,
            ]}
          >
            {scoreA ?? '—'}
          </Text>
        </View>
        <View style={[styles.feedTeamLine, { marginTop: 4 }]}>
          <Avatar url={sideBPhoto} name={sideBName} size={20} />
          <Text
            style={[
              styles.feedTeamName,
              !bWon && scoreB !== null && styles.feedTeamNameDim,
            ]}
            numberOfLines={1}
          >
            {sideBName}
          </Text>
          <Text
            style={[
              styles.feedScore,
              !bWon && scoreB !== null && styles.feedScoreDim,
            ]}
          >
            {scoreB ?? '—'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function StatCell({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <View style={styles.statCell}>
      <Text
        style={[
          styles.statValue,
          tone === 'positive' && { color: '#34d399' },
          tone === 'negative' && { color: '#f87171' },
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width={80} height={12} />
          <Skeleton width={200} height={28} />
        </View>
        <Skeleton width={44} height={44} radius={22} />
      </View>
      <Skeleton height={72} radius={16} />
      <Skeleton height={72} radius={16} />
      <Skeleton height={72} radius={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    marginTop: 4,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#0E1812', fontSize: 10, fontWeight: '800' },
  section: { marginTop: 24 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  arrow: { color: colors.textFaint, fontSize: 24, fontWeight: '300' },
  actions: { marginTop: 16, gap: 10 },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  goalsLine: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  statusTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 10,
    lineHeight: 26,
  },
  nextMatchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  nextMatchTeam: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  nextMatchTeamName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
    minHeight: 16,
  },
  nextMatchVs: {
    color: colors.textDim,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.4,
    paddingHorizontal: 4,
  },
  nextMatchDate: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  monthRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  monthCell: {
    flex: 1,
    alignItems: 'center',
  },
  monthValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 28,
  },
  monthLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  monthRecord: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  monthRecordText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  statusMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 17,
  },
  statusMuted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  statusHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  statusChipText: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  statusChipWarn: {
    borderColor: 'rgba(251,191,36,0.45)',
    backgroundColor: 'rgba(251,191,36,0.14)',
  },
  statusChipLive: {
    borderColor: '#f87171',
    backgroundColor: '#f87171',
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
    height: 44,
  },
  teamBadgePlaceholderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgePlaceholderText: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  teamBadgeName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  teamBadgeRole: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  mvpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.brandSoft,
  },
  mvpIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(224,185,124,0.14)',
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  mvpName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  mvpMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  statsHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 10,
    lineHeight: 18,
    textAlign: 'center',
  },
  pendingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
    justifyContent: 'center',
  },
  pendingChip: {
    alignItems: 'center',
    gap: 6,
    width: 60,
  },
  pendingChipName: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  cityPulseLine: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  emptyCta: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  feedRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    borderLeftWidth: 3,
    marginLeft: -4,
    gap: 12,
  },
  feedDateCol: {
    width: 86,
    gap: 4,
  },
  feedDate: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  feedKindChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 2,
  },
  feedKindChipText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  feedTeamLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedTeamName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  feedTeamNameDim: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  feedScore: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
    minWidth: 20,
    textAlign: 'right',
  },
  feedScoreDim: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  feedMeta: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 0.4,
  },
  feedCardOuter: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: 'rgba(255,255,255,0.025)',
    overflow: 'hidden',
  },
  friendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginTop: 10,
    marginLeft: 10,
    marginBottom: -2,
  },
  friendChipName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
    maxWidth: 180,
  },
  completeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completePercent: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  completeTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 10,
  },
  completeFill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: 2,
  },
  completeList: { marginTop: 12, gap: 6 },
  completeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completeLabel: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
    letterSpacing: -0.1,
  },
  completeLabelDone: {
    color: colors.text,
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textDim,
  },
  completeArrow: {
    color: colors.textDim,
    fontSize: 18,
    fontWeight: '300',
  },
  requestsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
