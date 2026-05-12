import { useCallback, useEffect, useState } from 'react';
import {
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
  fetchPendingChallengesForUser,
  fetchPendingReviewsForUser,
  formatRelativeMatchDate,
  type PendingChallenge,
  type PendingReview,
} from '@/lib/matches';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Avatar } from '@/components/Avatar';

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<TeamWithSport[]>([]);
  const [challenges, setChallenges] = useState<PendingChallenge[]>([]);
  const [reviews, setReviews] = useState<PendingReview[]>([]);
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
    const [myTeams, ch, rv] = await Promise.all([
      fetchMyTeams(session.user.id),
      fetchPendingChallengesForUser(session.user.id),
      fetchPendingReviewsForUser(session.user.id),
    ]);
    setTeams(myTeams);
    setChallenges(ch);
    setReviews(rv);
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
              <Avatar
                url={profile?.photo_url}
                name={profile?.name}
                size={44}
              />
            </Animated.View>

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
                teams.map((t, i) => (
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
                        <Text style={styles.arrow}>›</Text>
                      </View>
                    </Card>
                  </Animated.View>
                ))
              )}
            </Animated.View>

            <Animated.View
              entering={FadeIn.delay(360).duration(400)}
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
            </Animated.View>
          </>
        )}
      </ScrollView>
    </Screen>
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
    gap: 12,
    marginBottom: 24,
    marginTop: 4,
  },
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
});
