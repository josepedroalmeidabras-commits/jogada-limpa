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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchProfile,
  formatDisplayName,
  FOOT_LABEL,
  type Profile,
} from '@/lib/profile';
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
  computePersonalRecords,
  computeWinStreak,
  fetchUserMatchHistory,
  fetchDetailedMatchHistory,
  type MatchHistoryEntry,
  type DetailedMatchHistoryEntry,
} from '@/lib/history';
import { fetchMvpCount } from '@/lib/mvp';
import { colors } from '@/theme';
import { formatMatchDate } from '@/lib/matches';
import {
  canVoteOnPlayer,
  categoriesForPosition,
  emptyStats,
  fetchMyVotesForThisSeason,
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
import {
  fetchUserRatingHistory,
  type RatingHistoryEntry,
} from '@/lib/rating-history';
import { recentUsers } from '@/lib/recent';
import { RatingHistoryChart } from '@/components/RatingHistoryChart';
import { FormStrip, type FormResult } from '@/components/FormStrip';
import { PlayerFUTCard } from '@/components/PlayerFUTCard';
import { fetchInFormStatus, type InFormStatus } from '@/lib/in-form';
import { MatchHistoryRow } from '@/components/MatchHistoryRow';
import { StarRating } from '@/components/StarRating';
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
    is_internal: h.is_internal,
    side_a_label: h.side_a_label,
    side_b_label: h.side_b_label,
    referee_id: null,
    proposed_by: '',
    final_score_a: h.final_score_a,
    final_score_b: h.final_score_b,
    side_a: {
      id: myFirst ? 'my' : 'opp',
      name: myFirst ? h.my_team_name : h.opponent_team_name,
      city: '',
      captain_id: '',
      photo_url: null,
    },
    side_b: {
      id: myFirst ? 'opp' : 'my',
      name: myFirst ? h.opponent_team_name : h.my_team_name,
      city: '',
      captain_id: '',
      photo_url: null,
    },
  };
}

function tasteLabel(winPct: number, matches: number): string {
  if (matches < 3) return 'Sem dados ainda';
  if (winPct >= 70) return 'Em fogo';
  if (winPct >= 55) return 'A subir';
  if (winPct >= 40) return 'Equilibrado';
  if (winPct >= 25) return 'Em construção';
  return 'A reerguer-se';
}

function _legacyLevelLabel(elo: number): string {
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
  const [position, setPosition] = useState<string | null>(null);
  const [stats, setStats] = useState<AggregateStat[]>(emptyStats());
  const [canVote, setCanVote] = useState(false);
  const [allCatsVotedThisSeason, setAllCatsVotedThisSeason] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>('none');
  const [friendBusy, setFriendBusy] = useState(false);
  const [mutual, setMutual] = useState<{ list: MutualFriend[]; total: number }>({
    list: [],
    total: 0,
  });
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryEntry[]>([]);
  const [inForm, setInForm] = useState<InFormStatus | null>(null);
  const [detailedHistory, setDetailedHistory] = useState<DetailedMatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, s, a, h, mvp, cv, fs, mf, ss, rh, ifs, dh] = await Promise.all([
      fetchProfile(id),
      fetchUserSports(id),
      fetchReviewAggregate(id),
      fetchUserMatchHistory(id, 20),
      fetchMvpCount(id),
      canVoteOnPlayer(id),
      isSelf ? Promise.resolve<FriendshipStatus>('none') : fetchFriendshipStatus(id),
      isSelf ? Promise.resolve({ list: [], total: 0 }) : fetchMutualFriends(id, 5),
      fetchSeasonStats(id),
      fetchUserRatingHistory(id, 12),
      fetchInFormStatus(id),
      fetchDetailedMatchHistory(id, 5),
    ]);
    const positionRaw = s.find((x) => x.sport_id === 2)?.preferred_position ?? null;
    const ps = await fetchPlayerStats(id, positionRaw);
    // Já votei em todas as categorias deste user esta época?
    let allVoted = false;
    if (!isSelf) {
      const seasonVotes = await fetchMyVotesForThisSeason(id);
      const cats = categoriesForPosition(positionRaw);
      allVoted = cats.length > 0 && cats.every((c) => seasonVotes[c] !== undefined);
    }
    setProfile(p);
    setSports(s);
    setAggregate(a);
    setHistory(h);
    setPosition(positionRaw);
    setStats(ps);
    setCanVote(cv);
    setAllCatsVotedThisSeason(allVoted);
    setFriendStatus(fs);
    setMutual(mf);
    setSeasonStats(ss);
    setRatingHistory(rh);
    setMvpCount(mvp);
    setInForm(ifs);
    setDetailedHistory(dh);
    setLoading(false);
    if (p && !isSelf) {
      void recentUsers.add({
        id: p.id,
        name: p.name,
        photo_url: p.photo_url,
        meta: p.city,
      });
    }
  }, [id, isSelf]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen edges={["bottom"]}>
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
      <Screen edges={["bottom"]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted }}>Jogador não encontrado.</Text>
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

  const isLocked = !isSelf && profile.is_private && friendStatus !== 'friends';

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: profile.name,
          headerStyle: { backgroundColor: '#0E1812' },
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
      {isLocked ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Animated.View
            entering={FadeInDown.duration(300).springify()}
            style={{ alignItems: 'center', marginTop: 32 }}
          >
            <Avatar url={profile.photo_url} name={profile.name} size={88} />
            <Heading level={2} style={{ marginTop: 16 }}>
              {profile.name}
            </Heading>
            <Text style={[styles.muted, { marginTop: 6 }]}>{profile.city}</Text>
            <View style={styles.lockBlock}>
              <View style={styles.lockIcon}>
                <Ionicons name="lock-closed" size={26} color={colors.brand} />
              </View>
              <Text style={styles.lockTitle}>Perfil privado</Text>
              <Text style={styles.lockBody}>
                Só amigos aceites podem ver o histórico, estatísticas e jogos
                deste jogador. Envia pedido de amizade para desbloquear.
              </Text>
              {friendStatus === 'none' && (
                <Pressable
                  onPress={handleFriendAction}
                  disabled={friendBusy}
                  style={styles.lockCta}
                >
                  <Ionicons
                    name="person-add"
                    size={16}
                    color={colors.brand}
                  />
                  <Text style={styles.lockCtaText}>Pedir amizade</Text>
                </Pressable>
              )}
              {friendStatus === 'pending_sent' && (
                <Text style={styles.lockHint}>Pedido enviado · à espera.</Text>
              )}
              {friendStatus === 'pending_received' && (
                <Pressable
                  onPress={handleFriendAction}
                  disabled={friendBusy}
                  style={styles.lockCta}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.brand}
                  />
                  <Text style={styles.lockCtaText}>Aceitar pedido</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      ) : (
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.headerBlock}
        >
          <PlayerFUTCard
            profile={profile}
            stats={stats}
            position={position}
            winPct={
              sports[0]?.win_matches && sports[0].win_matches > 0
                ? Math.round(sports[0].win_pct)
                : null
            }
            matches={seasonStats?.matches_played ?? 0}
            goals={seasonStats?.goals ?? 0}
            assists={seasonStats?.assists ?? 0}
            form={history.slice(0, 5).map((h) => h.result).reverse()}
            inForm={!!inForm}
          />

          {(() => {
            // Mostra o CTA se:
            //  - é o meu próprio perfil (sempre); OU
            //  - é amigo + canVote + ainda não votei todas as categorias esta época
            const showVoteCta =
              canVote &&
              (isSelf || (friendStatus === 'friends' && !allCatsVotedThisSeason));
            if (!showVoteCta) return null;
            return (
              <Pressable
                onPress={() => router.push(`/(app)/users/${id}/stats-vote`)}
                style={({ pressed }) => [
                  styles.voteCta,
                  pressed && { transform: [{ scale: 0.985 }], opacity: 0.92 },
                ]}
              >
                <LinearGradient
                  colors={['#E0B97C', '#C9A26B', '#B58E55']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.voteCtaInner}
                >
                  <View style={styles.voteCtaIconWrap}>
                    <Ionicons name="star" size={20} color="#0E1812" />
                  </View>
                  <Text style={[styles.voteCtaTitle, { flex: 1 }]}>
                    {isSelf ? 'Sugerir os meus atributos' : 'Votar atributos'}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#0E1812" />
                </LinearGradient>
              </Pressable>
            );
          })()}

          {(() => {
            const s = sports[0];
            if (!s) return null;
            const hasComp = s.comp_matches > 0;
            const hasPel = s.pel_matches > 0;
            if (!hasComp && !hasPel) return null;
            return (
              <View style={styles.splitRow}>
                <View
                  style={[
                    styles.splitCell,
                    !hasComp && styles.splitCellDim,
                  ]}
                >
                  <Text style={styles.splitLabel}>Amigáveis</Text>
                  <Text style={styles.splitValue}>
                    {hasComp ? `${Math.round(s.comp_win_pct)}%` : '—'}
                  </Text>
                  <Text style={styles.splitMeta}>
                    {`${s.comp_matches} jogo${s.comp_matches === 1 ? '' : 's'}`}
                  </Text>
                </View>
                <View
                  style={[
                    styles.splitCell,
                    !hasPel && styles.splitCellDim,
                  ]}
                >
                  <Text style={[styles.splitLabel, styles.splitLabelGold]}>
                    Peladinha
                  </Text>
                  <Text style={[styles.splitValue, styles.splitValueGold]}>
                    {hasPel ? `${Math.round(s.pel_win_pct)}%` : '—'}
                  </Text>
                  <Text style={styles.splitMeta}>
                    {`${s.pel_matches} jogo${s.pel_matches === 1 ? '' : 's'}`}
                  </Text>
                </View>
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

        <Animated.View
          entering={FadeInDown.delay(55).springify()}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Eyebrow>Últimos jogos</Eyebrow>
            {detailedHistory.length > 0 && (
              <Pressable
                onPress={() => router.push(`/(app)/users/${id}/matches`)}
                style={styles.seeAllBtn}
              >
                <Text style={styles.seeAllText}>Ver todos</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.brand} />
              </Pressable>
            )}
          </View>
          {detailedHistory.length === 0 ? (
            <Card style={{ marginTop: 8 }}>
              <Text style={styles.muted}>Sem jogos validados.</Text>
            </Card>
          ) : (
            <View style={{ marginTop: 8 }}>
              {detailedHistory.map((m) => (
                <MatchHistoryRow
                  key={m.match_id}
                  m={m}
                  onPress={() => router.push(`/(app)/matches/${m.match_id}`)}
                />
              ))}
            </View>
          )}
        </Animated.View>

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
                  <Text style={styles.seasonLabel}>Golos</Text>
                </View>
                <View style={styles.seasonCell}>
                  <Text style={[styles.seasonValue, { color: '#34d399' }]}>
                    {seasonStats.assists}
                  </Text>
                  <Text style={styles.seasonLabel}>Assistências</Text>
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
          {!isSelf && session && (
            <View style={{ marginTop: 8 }}>
              <Button
                label="↔ Comparar contigo"
                variant="ghost"
                full
                onPress={() =>
                  router.push(
                    `/(app)/users/compare?a=${session.user.id}&b=${id}`,
                  )
                }
              />
            </View>
          )}
        </Animated.View>

        {enoughReviews && (
          <Animated.View
            entering={FadeInDown.delay(140).springify()}
            style={styles.section}
          >
            <Eyebrow>Reputação</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              <View style={styles.starsHero}>
                <StarRating
                  value={aggregate!.avg_overall ?? 0}
                  size={28}
                />
                <Text style={styles.starsHeroValue}>
                  {(aggregate!.avg_overall ?? 0).toFixed(1)}
                </Text>
              </View>
              <Text style={styles.aggFoot}>
                {`${aggregate!.total_reviews} avaliações recebidas`}
              </Text>
            </Card>
          </Animated.View>
        )}

        {ratingHistory.length >= 1 && (
          <Animated.View
            entering={FadeInDown.delay(180).springify()}
            style={styles.section}
          >
            <Eyebrow>{`Prestação (últimos ${ratingHistory.length} jogos)`}</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              <RatingHistoryChart rows={ratingHistory} />
            </Card>
          </Animated.View>
        )}

        {history.length > 0 && (() => {
          const records = computePersonalRecords(history);
          const hasAny =
            records.biggest_win ||
            records.biggest_loss ||
            records.longest_streak > 0;
          if (!hasAny) return null;
          return (
            <Animated.View
              entering={FadeInDown.delay(180).springify()}
              style={styles.section}
            >
              <Eyebrow>Recordes</Eyebrow>
              <Card style={{ marginTop: 8 }}>
                {records.biggest_win && (
                  <RecordRow
                    icon="trophy"
                    tint={colors.brand}
                    label="Maior vitória"
                    value={`+${records.biggest_win.margin} vs ${records.biggest_win.opponent}`}
                  />
                )}
                {records.biggest_loss && (
                  <RecordRow
                    icon="heart-dislike"
                    tint={colors.danger}
                    label="Pior derrota"
                    value={`-${records.biggest_loss.margin} vs ${records.biggest_loss.opponent}`}
                  />
                )}
                {records.longest_streak > 0 && (
                  <RecordRow
                    icon="flame"
                    tint={colors.warning}
                    label="Melhor sequência"
                    value={`${records.longest_streak} vitórias seguidas`}
                  />
                )}
              </Card>
            </Animated.View>
          );
        })()}

      </ScrollView>
      )}
    </Screen>
  );
}

function RecordRow({
  icon,
  tint,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.recordRow}>
      <View
        style={[
          styles.recordIconRing,
          { borderColor: tint + '55', backgroundColor: tint + '14' },
        ]}
      >
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recordLabel}>{label}</Text>
        <Text style={styles.recordValue}>{value}</Text>
      </View>
    </View>
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
  scroll: { paddingHorizontal: 24, paddingBottom: 48, paddingTop: 8 },
  voteCta: {
    marginTop: 14,
    alignSelf: 'stretch',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#C9A26B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  voteCtaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  voteCtaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(14,24,18,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(14,24,18,0.25)',
  },
  voteCtaTitle: {
    color: '#0E1812',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  voteCtaSub: {
    color: 'rgba(14,24,18,0.7)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.1,
  },
  headerBlock: {
    alignItems: 'center',
    gap: 6,
    marginTop: 0,
  },
  city: { color: colors.textMuted, fontSize: 14, letterSpacing: -0.1 },
  avatarRow: { position: 'relative' },
  jerseyBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 32,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#C9A26B',
    borderWidth: 3,
    borderColor: '#0E1812',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: {
    color: '#0E1812',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
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
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mutualAvatars: { flexDirection: 'row', alignItems: 'center' },
  mutualAvatarWrap: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0E1812',
  },
  mutualText: {
    color: colors.textMuted,
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
  formRow: {
    marginTop: 12,
    alignItems: 'center',
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
  splitRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  splitCell: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'flex-start',
  },
  splitCellDim: {
    opacity: 0.5,
  },
  splitLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  splitLabelGold: {
    color: colors.goldDeep,
  },
  splitValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 6,
    lineHeight: 34,
  },
  splitValueGold: {
    color: colors.goldDeep,
  },
  splitMeta: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  seeAllText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  lockBlock: {
    marginTop: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  lockIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  lockBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
  },
  lockCta: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  lockCtaText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  lockHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  elo: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  muted: { color: colors.textDim, fontSize: 13 },
  aggRow: { marginBottom: 12 },
  aggHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  aggLabel: { color: '#d4d4d4', fontSize: 13 },
  aggValue: { color: colors.textMuted, fontSize: 12 },
  aggTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  aggFill: { height: '100%', backgroundColor: '#fbbf24' },
  aggFoot: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  starsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  starsHeroValue: {
    color: colors.goldDeep,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
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
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 1,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  recordIconRing: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  recordValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
});
