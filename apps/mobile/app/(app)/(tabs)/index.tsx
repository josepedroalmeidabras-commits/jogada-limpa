import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeIn,
} from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { supabase } from '@/lib/supabase';
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchMyTeams, type TeamWithSport } from '@/lib/teams';
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
import { Avatar } from '@/components/Avatar';
import { fetchUnreadCount } from '@/lib/notifications';
import { fetchUnreadByTeam } from '@/lib/chat';
import {
  computeMonthlyStats,
  computeWinStreak,
  fetchUserMatchHistory,
  type MatchHistoryEntry,
  type MonthlyStats,
} from '@/lib/history';
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
import { fetchPlayerStats } from '@/lib/player-stats';
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
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [chatUnread, setChatUnread] = useState<Record<string, number>>({});
  const [friendsActivity, setFriendsActivity] = useState<FriendMatchEvent[]>([]);
  const [nextMatch, setNextMatch] = useState<MatchSummary | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [peladinhas, setPeladinhas] = useState<PendingPeladinhaInvite[]>([]);
  const [completeness, setCompleteness] = useState<{
    items: { key: string; label: string; done: boolean }[];
    percent: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      fetchPlayerStats(session.user.id),
      fetchNextMatchForUser(session.user.id),
      fetchPendingPeladinhaInvites(),
    ]);
    setTeams(myTeams);
    setChallenges(ch);
    setReviews(rv);
    setActivity(act);
    setUnread(u);
    setMonthly(computeMonthlyStats(hist));
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
    if (myTeams.length > 0) {
      const unreadByTeam = await fetchUnreadByTeam(
        myTeams.map((t) => t.id),
        session.user.id,
      );
      setChatUnread(unreadByTeam);
    }
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

  return (
    <Screen>
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
              <View style={{ flex: 1 }}>
                {(() => {
                  const streak = computeWinStreak(history);
                  const hour = new Date().getHours();
                  const greet =
                    hour < 6 ? 'Madrugada'
                    : hour < 12 ? 'Bom dia'
                    : hour < 19 ? 'Boa tarde'
                    : 'Boa noite';
                  let eyebrow: string = profile?.city ?? '';
                  if (streak.current >= 5) eyebrow = `🌋 ${streak.current} vitórias seguidas`;
                  else if (streak.current >= 3) eyebrow = `🔥 ${streak.current} vitórias seguidas`;
                  return (
                    <>
                      <Eyebrow>{eyebrow}</Eyebrow>
                      <Heading level={1} style={{ marginTop: 4 }}>
                        {`${greet}, ${(profile?.name ?? '').split(' ')[0]}`}
                      </Heading>
                    </>
                  );
                })()}
              </View>
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
              <Avatar
                url={profile?.photo_url}
                name={profile?.name}
                size={44}
              />
            </Animated.View>

            {nextMatch && (() => {
              const scheduled = new Date(nextMatch.scheduled_at).getTime();
              const diff = scheduled - now;
              const mins = Math.floor(diff / 60_000);
              const hours = Math.floor(mins / 60);
              const days = Math.floor(hours / 24);
              const urgent = diff > 0 && diff < 2 * 60 * 60 * 1000;
              const live = diff <= 0 && diff > -4 * 60 * 60 * 1000;

              let when: string;
              let badge: string | null = null;
              if (live) {
                when = 'A decorrer agora';
                badge = '🔴 AO VIVO';
              } else if (diff <= 0) {
                when = 'Acabou de terminar';
              } else if (mins < 60) {
                when = `Em ${mins} minuto${mins === 1 ? '' : 's'}`;
                badge = 'AGORA';
              } else if (hours < 24) {
                const remMins = mins % 60;
                when = remMins === 0
                  ? `Em ${hours}h`
                  : `Em ${hours}h ${remMins}min`;
                badge = 'HOJE';
              } else if (days < 2) {
                when = `Amanhã às ${new Date(nextMatch.scheduled_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
                badge = 'AMANHÃ';
              } else {
                when = formatRelativeMatchDate(nextMatch.scheduled_at);
              }

              return (
                <Animated.View entering={FadeInDown.delay(40).springify()}>
                  <Pressable
                    onPress={() =>
                      router.push(`/(app)/matches/${nextMatch.id}`)
                    }
                    style={[
                      styles.nextMatchCard,
                      urgent && styles.nextMatchCardUrgent,
                      live && styles.nextMatchCardLive,
                    ]}
                  >
                    <View style={styles.nextMatchHeader}>
                      <Text style={styles.nextMatchLabel}>📅 Próximo jogo</Text>
                      {badge && (
                        <View
                          style={[
                            styles.nextMatchBadge,
                            urgent && styles.nextMatchBadgeUrgent,
                            live && styles.nextMatchBadgeLive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.nextMatchBadgeText,
                              (urgent || live) && { color: '#0a0a0a' },
                            ]}
                          >
                            {badge}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.nextMatchTeams} numberOfLines={1}>
                      {`${nextMatch.side_a.name}  vs  ${nextMatch.side_b.name}`}
                    </Text>
                    <Text
                      style={[
                        styles.nextMatchWhen,
                        urgent && { color: '#f87171' },
                        live && { color: '#f87171' },
                      ]}
                    >
                      {when}
                    </Text>
                    <Text style={styles.nextMatchWhere} numberOfLines={1}>
                      {`📍 ${nextMatch.location_tbd ? 'A combinar' : (nextMatch.location_name ?? '—')}`}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })()}

            {(teams.length === 0 || history.length === 0) && (
              <Animated.View entering={FadeInDown.delay(45).springify()}>
                <Card variant="subtle">
                  <Eyebrow>🚀 Próximos passos</Eyebrow>
                  <View style={styles.guideList}>
                    <GuideRow
                      done={teams.length > 0}
                      label="Cria ou junta-te a uma equipa"
                    />
                    <GuideRow
                      done={
                        teams.some(
                          (t) => t.captain_id === session?.user.id,
                        ) || teams.length > 1
                      }
                      label="Convida pelo menos 1 jogador"
                    />
                    <GuideRow
                      done={!!nextMatch || history.length > 0}
                      label="Marca o primeiro jogo"
                    />
                    <GuideRow
                      done={history.length > 0}
                      label="Joga e valida o resultado"
                    />
                  </View>
                </Card>
              </Animated.View>
            )}

            {completeness && completeness.percent < 100 && (
              <Animated.View entering={FadeInDown.delay(50).springify()}>
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
                    {completeness.items.map((it) => (
                      <View key={it.key} style={styles.completeItem}>
                        <Ionicons
                          name={it.done ? 'checkmark-circle' : 'ellipse-outline'}
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
                      </View>
                    ))}
                  </View>
                  <View style={{ marginTop: 12 }}>
                    <Button
                      label="Continuar perfil"
                      variant="secondary"
                      size="sm"
                      onPress={() => router.push('/(app)/profile/edit')}
                      full
                    />
                  </View>
                </Card>
              </Animated.View>
            )}

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
                <Eyebrow>{`⚡ Peladinhas · ${peladinhas.length} por confirmar`}</Eyebrow>
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

            {monthly && monthly.matches > 0 && (
              <Animated.View
                entering={FadeInDown.delay(70).springify()}
              >
                <Card variant="subtle">
                  <Eyebrow>Este mês</Eyebrow>
                  <View style={styles.statsRow}>
                    <StatCell
                      value={String(monthly.matches)}
                      label={monthly.matches === 1 ? 'jogo' : 'jogos'}
                    />
                    <StatCell
                      value={String(monthly.wins)}
                      label="vitórias"
                      tone="positive"
                    />
                    <StatCell
                      value={String(monthly.draws)}
                      label="empates"
                    />
                    <StatCell
                      value={String(monthly.losses)}
                      label="derrotas"
                      tone="negative"
                    />
                  </View>
                  {(monthly.goals_for > 0 || monthly.goals_against > 0) && (
                    <Text style={styles.goalsLine}>
                      {`Golos · ${monthly.goals_for} marcados · ${monthly.goals_against} sofridos`}
                    </Text>
                  )}
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
              entering={FadeInDown.delay(200).springify()}
              style={styles.section}
            >
              <Eyebrow>As tuas equipas</Eyebrow>
              {teams.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.emptyTitle}>Sem equipas ainda</Text>
                  <Text style={styles.emptyBody}>
                    Cria a tua equipa e convida jogadores, ou entra noutra com
                    um código.
                  </Text>
                </Card>
              ) : (
                teams.map((t, i) => {
                  const unreadChat = chatUnread[t.id] ?? 0;
                  return (
                    <Animated.View
                      key={t.id}
                      entering={FadeInDown.delay(240 + i * 40).springify()}
                    >
                      <Card
                        onPress={() => router.push(`/(app)/teams/${t.id}`)}
                        style={{ marginTop: 8 }}
                      >
                        <View style={styles.cardRow}>
                          <Avatar
                            url={t.photo_url}
                            name={t.name}
                            size={44}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardName}>{t.name}</Text>
                            <Text style={styles.cardMeta}>
                              {`${t.sport?.name ?? 'Futebol 7'} · ${t.city}`}
                            </Text>
                          </View>
                          {unreadChat > 0 && (
                            <View style={styles.chatBadge}>
                              <Ionicons
                                name="chatbubble"
                                size={10}
                                color="#0a0a0a"
                              />
                              <Text style={styles.chatBadgeText}>
                                {unreadChat > 9 ? '9+' : String(unreadChat)}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.arrow}>›</Text>
                        </View>
                      </Card>
                    </Animated.View>
                  );
                })
              )}
            </Animated.View>

            {friendsActivity.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(280).springify()}
                style={styles.section}
              >
                <Eyebrow>Os teus amigos jogaram</Eyebrow>
                {friendsActivity.map((m, i) => (
                  <Animated.View
                    key={m.match_id}
                    entering={FadeInDown.delay(320 + i * 30).springify()}
                  >
                    <Card
                      onPress={() =>
                        router.push(`/(app)/matches/${m.match_id}`)
                      }
                      style={{ marginTop: 8 }}
                    >
                      <View style={styles.cardRow}>
                        <Avatar
                          url={m.friend_photo}
                          name={m.friend_name}
                          size={36}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardName}>
                            {`${m.side_a_name} ${m.final_score_a}–${m.final_score_b} ${m.side_b_name}`}
                          </Text>
                          <Text style={styles.cardMeta}>
                            {`${m.friend_name.split(' ')[0]} · ${formatMatchDate(m.scheduled_at)}`}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            {activity.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(360).springify()}
                style={styles.section}
              >
                <Eyebrow>{`Atividade em ${profile?.city ?? ''}`}</Eyebrow>
                {activity.map((m, i) => (
                  <Animated.View
                    key={m.match_id}
                    entering={FadeInDown.delay(340 + i * 30).springify()}
                  >
                    <Card
                      onPress={() => router.push(`/(app)/matches/${m.match_id}`)}
                      style={{ marginTop: 8 }}
                    >
                      <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardName}>
                            {`${m.side_a_name} ${m.final_score_a} – ${m.final_score_b} ${m.side_b_name}`}
                          </Text>
                          <Text style={styles.cardMeta}>
                            {formatMatchDate(m.scheduled_at)}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            <Animated.View
              entering={FadeIn.delay(400).duration(400)}
              style={styles.actions}
            >
              <Button
                label="Criar equipa"
                size="lg"
                full
                haptic="medium"
                onPress={() => router.push('/(app)/teams/new')}
              />
              <Button
                label="Entrar com código"
                variant="secondary"
                size="lg"
                full
                onPress={() => router.push('/(app)/teams/join')}
              />
              <Button
                label="🔔 Oportunidades abertas"
                variant="ghost"
                size="md"
                full
                onPress={() => router.push('/(app)/opportunities')}
              />
              <Button
                label="🏟️ Mercado livre"
                variant="ghost"
                size="md"
                full
                onPress={() => router.push('/(app)/market')}
              />
            </Animated.View>
          </>
        )}
      </ScrollView>
    </Screen>
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

function GuideRow({ done, label }: { done: boolean; label: string }) {
  return (
    <View style={styles.guideRow}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={done ? colors.brand : colors.textDim}
      />
      <Text
        style={[
          styles.guideLabel,
          done && {
            color: colors.text,
            textDecorationLine: 'line-through',
            textDecorationColor: colors.textDim,
          },
        ]}
      >
        {label}
      </Text>
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
  scroll: { padding: 24, paddingBottom: 48 },
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
  bellBadgeText: { color: '#0a0a0a', fontSize: 10, fontWeight: '800' },
  section: { marginTop: 24 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardMeta: {
    color: '#a3a3a3',
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  arrow: { color: '#5a5a5a', fontSize: 24, fontWeight: '300' },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  emptyBody: {
    color: '#a3a3a3',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  actions: { marginTop: 32, gap: 8 },
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
  nextMatchCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    marginBottom: 8,
  },
  nextMatchCardUrgent: {
    backgroundColor: 'rgba(248,113,113,0.10)',
    borderColor: 'rgba(248,113,113,0.40)',
  },
  nextMatchCardLive: {
    backgroundColor: 'rgba(248,113,113,0.16)',
    borderColor: 'rgba(248,113,113,0.6)',
  },
  nextMatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextMatchLabel: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nextMatchBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  nextMatchBadgeUrgent: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  nextMatchBadgeLive: {
    backgroundColor: '#f87171',
    borderColor: '#f87171',
  },
  nextMatchBadgeText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  nextMatchTeams: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 8,
  },
  nextMatchWhen: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: -0.2,
  },
  nextMatchWhere: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  chatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  chatBadgeText: { color: '#0a0a0a', fontSize: 11, fontWeight: '800' },
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
  guideList: { marginTop: 10, gap: 8 },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guideLabel: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
    letterSpacing: -0.1,
  },
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
