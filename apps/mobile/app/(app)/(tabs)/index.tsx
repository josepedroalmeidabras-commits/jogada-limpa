import { useCallback, useEffect, useState } from 'react';
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
  fetchPendingChallengesForUser,
  fetchPendingReviewsForUser,
  formatMatchDate,
  formatRelativeMatchDate,
  type CityActivity,
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
  fetchUserMatchHistory,
  type MonthlyStats,
} from '@/lib/history';
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
  const [chatUnread, setChatUnread] = useState<Record<string, number>>({});
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
    const [myTeams, ch, rv, act, u, hist] = await Promise.all([
      fetchMyTeams(session.user.id),
      fetchPendingChallengesForUser(session.user.id),
      fetchPendingReviewsForUser(session.user.id),
      fetchCityActivity(p.city, 5),
      fetchUnreadCount(session.user.id),
      fetchUserMatchHistory(session.user.id, 50),
    ]);
    setTeams(myTeams);
    setChallenges(ch);
    setReviews(rv);
    setActivity(act);
    setUnread(u);
    setMonthly(computeMonthlyStats(hist));
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
                <Eyebrow>{profile?.city ?? ''}</Eyebrow>
                <Heading level={1} style={{ marginTop: 4 }}>
                  {`Olá, ${(profile?.name ?? '').split(' ')[0]}`}
                </Heading>
              </View>
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

            {monthly && monthly.matches > 0 && (
              <Animated.View
                entering={FadeInDown.delay(60).springify()}
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

            {activity.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(300).springify()}
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
});
