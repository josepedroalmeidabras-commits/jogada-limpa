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
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';
import {
  blockUser,
  REPORT_REASON_LABELS,
  type ReportReason,
} from '@/lib/moderation';
import {
  fetchReviewAggregate,
  fetchUserSports,
  type ReviewAggregate,
  type UserSportElo,
} from '@/lib/reviews';
import {
  computeWinStreak,
  fetchUserMatchHistory,
  type MatchHistoryEntry,
} from '@/lib/history';
import { fetchMvpCount } from '@/lib/mvp';
import { colors } from '@/theme';
import { formatMatchDate } from '@/lib/matches';
import {
  canVoteOnPlayer,
  emptyStats,
  fetchPlayerStats,
  overallRating,
  totalVotes,
  type AggregateStat,
} from '@/lib/player-stats';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendshipStatus,
  fetchMutualFriends,
  removeFriend,
  sendFriendRequest,
  type FriendshipStatus,
  type MutualFriend,
} from '@/lib/friends';
import { fetchSeasonStats, type SeasonStats } from '@/lib/season-stats';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Skeleton } from '@/components/Skeleton';
import { PlayerStatsCard } from '@/components/PlayerStatsCard';
import { Button } from '@/components/Button';
import {
  MatchListItem,
  MatchListGroup,
} from '@/components/MatchListItem';
import type { MatchSummary } from '@/lib/matches';

const MIN_REVIEWS_TO_SHOW = 5;

function historyToMatchSummary(h: MatchHistoryEntry): MatchSummary {
  const myFirst = h.my_side === 'A';
  return {
    id: h.match_id,
    sport_id: 0,
    scheduled_at: h.scheduled_at,
    status: 'validated',
    location_name: null,
    location_tbd: false,
    message: null,
    notes: null,
    proposed_by: '',
    final_score_a: h.final_score_a,
    final_score_b: h.final_score_b,
    side_a: {
      id: myFirst ? 'my' : 'opp',
      name: myFirst ? h.my_team_name : h.opponent_team_name,
      city: '',
      captain_id: '',
    },
    side_b: {
      id: myFirst ? 'opp' : 'my',
      name: myFirst ? h.opponent_team_name : h.my_team_name,
      city: '',
      captain_id: '',
    },
  };
}

function levelLabel(elo: number): string {
  if (elo < 1100) return 'Casual';
  if (elo < 1300) return 'Intermédio';
  if (elo < 1500) return 'Avançado';
  return 'Competitivo';
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const isSelf = session?.user.id === id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sports, setSports] = useState<UserSportElo[]>([]);
  const [aggregate, setAggregate] = useState<ReviewAggregate | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [mvpCount, setMvpCount] = useState(0);
  const [stats, setStats] = useState<AggregateStat[]>(emptyStats());
  const [canVote, setCanVote] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>('none');
  const [friendBusy, setFriendBusy] = useState(false);
  const [mutual, setMutual] = useState<{ list: MutualFriend[]; total: number }>({
    list: [],
    total: 0,
  });
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, s, a, h, mvp, ps, cv, fs, mf, ss] = await Promise.all([
      fetchProfile(id),
      fetchUserSports(id),
      fetchReviewAggregate(id),
      fetchUserMatchHistory(id, 20),
      fetchMvpCount(id),
      fetchPlayerStats(id),
      canVoteOnPlayer(id),
      isSelf ? Promise.resolve<FriendshipStatus>('none') : fetchFriendshipStatus(id),
      isSelf ? Promise.resolve({ list: [], total: 0 }) : fetchMutualFriends(id, 5),
      fetchSeasonStats(id),
    ]);
    setProfile(p);
    setSports(s);
    setAggregate(a);
    setHistory(h);
    setStats(ps);
    setCanVote(cv);
    setFriendStatus(fs);
    setMutual(mf);
    setSeasonStats(ss);
    setMvpCount(mvp);
    setLoading(false);
  }, [id, isSelf]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={{ padding: 24, gap: 12, alignItems: 'center' }}>
          <Skeleton width={80} height={80} radius={40} />
          <Skeleton width={160} height={28} />
          <Skeleton width={120} height={14} />
          <Skeleton height={80} radius={16} style={{ marginTop: 16, width: '100%' }} />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#a3a3a3' }}>Jogador não encontrado.</Text>
        </View>
      </Screen>
    );
  }

  const enoughReviews =
    aggregate && aggregate.total_reviews >= MIN_REVIEWS_TO_SHOW;

  function handleConfirmBlock() {
    if (!profile) return;
    Alert.alert(
      'Bloquear jogador?',
      `${profile.name} deixa de te ver no mercado e tu não vês ${profile.name}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: async () => {
            const r = await blockUser(profile.id);
            if (!r.ok) {
              Alert.alert('Erro', r.message ?? 'Não foi possível bloquear.');
              return;
            }
            router.back();
          },
        },
      ],
    );
  }

  async function handleFriendAction() {
    if (!profile) return;
    setFriendBusy(true);
    let r: { ok: true } | { ok: false; message: string };
    if (friendStatus === 'none') {
      r = await sendFriendRequest(profile.id);
      if (r.ok) setFriendStatus('pending_sent');
    } else if (friendStatus === 'pending_sent') {
      r = await cancelFriendRequest(profile.id);
      if (r.ok) setFriendStatus('none');
    } else if (friendStatus === 'pending_received') {
      r = await acceptFriendRequest(profile.id);
      if (r.ok) {
        setFriendStatus('friends');
        // refresh stats vote eligibility
        const cv = await canVoteOnPlayer(profile.id);
        setCanVote(cv);
      }
    } else {
      // already friends — confirm before removing
      setFriendBusy(false);
      Alert.alert('Remover amigo?', `${profile.name} deixa de ser teu amigo.`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setFriendBusy(true);
            const rr = await removeFriend(profile.id);
            setFriendBusy(false);
            if (!rr.ok) {
              Alert.alert('Erro', rr.message);
              return;
            }
            setFriendStatus('none');
            const cv = await canVoteOnPlayer(profile.id);
            setCanVote(cv);
          },
        },
      ]);
      return;
    }
    setFriendBusy(false);
    if (!r.ok) Alert.alert('Erro', r.message);
  }

  async function handleDeclineRequest() {
    if (!profile) return;
    setFriendBusy(true);
    const r = await declineFriendRequest(profile.id);
    setFriendBusy(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    setFriendStatus('none');
  }

  function handleReport() {
    if (!profile) return;
    const reasons = Object.keys(REPORT_REASON_LABELS) as ReportReason[];
    router.push({
      pathname: '/(app)/users/[id]/report',
      params: { id: profile.id, name: profile.name },
    });
    void reasons;
  }

  function openActions() {
    if (!profile) return;
    const options = ['Reportar', 'Bloquear', 'Cancelar'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 2,
          destructiveButtonIndex: 1,
          title: profile.name,
        },
        (idx) => {
          if (idx === 0) handleReport();
          if (idx === 1) handleConfirmBlock();
        },
      );
    } else {
      Alert.alert(profile.name, undefined, [
        { text: 'Reportar', onPress: handleReport },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: handleConfirmBlock,
        },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: profile.name,
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          headerRight: () =>
            isSelf ? null : (
              <Pressable
                onPress={openActions}
                hitSlop={12}
                style={{ paddingHorizontal: 4 }}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={22}
                  color={colors.text}
                />
              </Pressable>
            ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.headerBlock}
        >
          <Avatar url={profile.photo_url} name={profile.name} size={96} />
          <Heading level={1} style={{ marginTop: 16, textAlign: 'center' }}>
            {profile.name}
          </Heading>
          <Text style={styles.city}>{profile.city}</Text>

          {(() => {
            const streak = computeWinStreak(history);
            const show = streak.current >= 2 || mvpCount > 0;
            if (!show) return null;
            return (
              <View style={styles.badgeRow}>
                {streak.current >= 2 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {`🔥 ${streak.current}`}
                    </Text>
                  </View>
                )}
                {mvpCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {`👑 ${mvpCount}`}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}
        </Animated.View>

        {!isSelf && mutual.total > 0 && (
          <Animated.View
            entering={FadeInDown.delay(40).springify()}
            style={styles.mutualRow}
          >
            <View style={styles.mutualAvatars}>
              {mutual.list.slice(0, 3).map((m, i) => (
                <View
                  key={m.id}
                  style={[
                    styles.mutualAvatarWrap,
                    { marginLeft: i === 0 ? 0 : -10 },
                  ]}
                >
                  <Avatar url={m.photo_url} name={m.name} size={22} />
                </View>
              ))}
            </View>
            <Text style={styles.mutualText}>
              {mutual.total === 1
                ? `1 amigo em comum: ${mutual.list[0]?.name.split(' ')[0]}`
                : mutual.total <= 3
                  ? `${mutual.total} amigos em comum: ${mutual.list
                      .map((m) => m.name.split(' ')[0])
                      .join(', ')}`
                  : `${mutual.list[0]?.name.split(' ')[0]}, ${mutual.list[1]?.name.split(' ')[0]} e mais ${mutual.total - 2}`}
            </Text>
          </Animated.View>
        )}

        {!isSelf && (
          <Animated.View
            entering={FadeInDown.delay(50).springify()}
            style={{ marginTop: 16 }}
          >
            {friendStatus === 'pending_received' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Aceitar pedido"
                    haptic="medium"
                    loading={friendBusy}
                    onPress={handleFriendAction}
                    full
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Recusar"
                    variant="secondary"
                    onPress={handleDeclineRequest}
                    full
                  />
                </View>
              </View>
            ) : (
              <Button
                label={
                  friendStatus === 'friends'
                    ? '✓ Amigos'
                    : friendStatus === 'pending_sent'
                      ? 'Pedido enviado · tocar para cancelar'
                      : '+ Adicionar amigo'
                }
                variant={
                  friendStatus === 'friends' ? 'secondary' : 'primary'
                }
                loading={friendBusy}
                onPress={handleFriendAction}
                full
              />
            )}
          </Animated.View>
        )}

        {profile.bio && (
          <Animated.View
            entering={FadeInDown.delay(60).springify()}
            style={styles.section}
          >
            <Card>
              <Text style={styles.bio}>{profile.bio}</Text>
            </Card>
          </Animated.View>
        )}

        {seasonStats && seasonStats.matches_played > 0 && (
          <Animated.View
            entering={FadeInDown.delay(65).springify()}
            style={styles.section}
          >
            <Eyebrow>Esta época</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              <View style={styles.seasonRow}>
                <View style={styles.seasonCell}>
                  <Text style={styles.seasonValue}>
                    {seasonStats.matches_played}
                  </Text>
                  <Text style={styles.seasonLabel}>
                    {seasonStats.matches_played === 1 ? 'jogo' : 'jogos'}
                  </Text>
                </View>
                <View style={styles.seasonCell}>
                  <Text style={[styles.seasonValue, { color: '#fbbf24' }]}>
                    {seasonStats.goals}
                  </Text>
                  <Text style={styles.seasonLabel}>⚽ golos</Text>
                </View>
                <View style={styles.seasonCell}>
                  <Text style={[styles.seasonValue, { color: '#34d399' }]}>
                    {seasonStats.assists}
                  </Text>
                  <Text style={styles.seasonLabel}>🎁 assist.</Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(70).springify()}
          style={styles.section}
        >
          <PlayerStatsCard
            stats={stats}
            overall={overallRating(stats)}
            totalVotes={totalVotes(stats)}
          />
          {canVote && (
            <View style={{ marginTop: 12 }}>
              <Button
                label={isSelf ? 'Sugerir os meus atributos' : 'Votar atributos'}
                variant="secondary"
                full
                onPress={() =>
                  router.push(`/(app)/users/${id}/stats-vote`)
                }
              />
            </View>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={styles.section}
        >
          <Eyebrow>ELO por desporto</Eyebrow>
          {sports.length === 0 ? (
            <Card style={{ marginTop: 8 }}>
              <Text style={styles.muted}>Sem desportos no perfil.</Text>
            </Card>
          ) : (
            sports.map((s) => (
              <Card key={s.sport_id} style={{ marginTop: 8 }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{s.sport?.name}</Text>
                    <Text style={styles.rowMeta}>
                      {`${levelLabel(s.elo)} · ${s.matches_played} jogos`}
                    </Text>
                  </View>
                  <Text style={styles.elo}>{Math.round(s.elo)}</Text>
                </View>
              </Card>
            ))
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(140).springify()}
          style={styles.section}
        >
          <Eyebrow>Reputação</Eyebrow>
          {enoughReviews ? (
            <Card style={{ marginTop: 8 }}>
              <AggBar label="Fair play" value={aggregate!.avg_fair_play} />
              <AggBar label="Pontualidade" value={aggregate!.avg_punctuality} />
              <AggBar
                label="Nível técnico"
                value={aggregate!.avg_technical_level}
              />
              <AggBar label="Atitude" value={aggregate!.avg_attitude} />
              <Text style={styles.aggFoot}>
                {`${aggregate!.total_reviews} avaliações recebidas`}
              </Text>
            </Card>
          ) : (
            <Card style={{ marginTop: 8 }}>
              <Text style={styles.muted}>
                {`Em construção — precisa de pelo menos ${MIN_REVIEWS_TO_SHOW} avaliações.`}
              </Text>
            </Card>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={styles.section}
        >
          <Eyebrow>Últimos jogos</Eyebrow>
          {history.length === 0 ? (
            <Card style={{ marginTop: 8 }}>
              <Text style={styles.muted}>Sem jogos validados.</Text>
            </Card>
          ) : (
            <View style={{ marginTop: 8 }}>
              <MatchListGroup>
                {history.map((h) => (
                  <MatchListItem
                    key={h.match_id}
                    match={historyToMatchSummary(h)}
                    highlightTeamId="my"
                    onPress={() => router.push(`/(app)/matches/${h.match_id}`)}
                  />
                ))}
              </MatchListGroup>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function AggBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value / 5));
  return (
    <View style={styles.aggRow}>
      <View style={styles.aggHeader}>
        <Text style={styles.aggLabel}>{label}</Text>
        <Text style={styles.aggValue}>{value.toFixed(1)} / 5</Text>
      </View>
      <View style={styles.aggTrack}>
        <View style={[styles.aggFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  headerBlock: {
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  city: { color: '#a3a3a3', fontSize: 14, letterSpacing: -0.1 },
  bio: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  mutualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  seasonRow: { flexDirection: 'row' },
  seasonCell: { flex: 1, alignItems: 'center' },
  seasonValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  seasonLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mutualAvatars: { flexDirection: 'row', alignItems: 'center' },
  mutualAvatarWrap: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  mutualText: {
    color: '#a3a3a3',
    fontSize: 12,
    flex: 1,
    letterSpacing: -0.1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  badgeText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  section: { marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowMeta: {
    color: '#a3a3a3',
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  elo: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  muted: { color: '#737373', fontSize: 13 },
  aggRow: { marginBottom: 12 },
  aggHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  aggLabel: { color: '#d4d4d4', fontSize: 13 },
  aggValue: { color: '#a3a3a3', fontSize: 12 },
  aggTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  aggFill: { height: '100%', backgroundColor: '#fbbf24' },
  aggFoot: {
    color: '#737373',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  score: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  win: { color: '#34d399' },
  loss: { color: '#f87171' },
  resultLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
});
