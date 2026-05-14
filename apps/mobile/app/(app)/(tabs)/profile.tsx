import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchProfile,
  formatDisplayName,
  FOOT_LABEL,
  type Profile,
} from '@/lib/profile';
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
import { formatMatchDate } from '@/lib/matches';
import { fetchMvpCount } from '@/lib/mvp';
import { fetchMyTeams } from '@/lib/teams';
import { computeAchievements, type Achievement } from '@/lib/achievements';
import {
  fetchSeasonStats,
  fetchPlayerYearStats,
  type SeasonStats,
  type YearStats,
} from '@/lib/season-stats';
import {
  fetchMySelfRatingSummary,
  type SelfRatingSummary,
} from '@/lib/self-rating';
import { fetchPlayerStats, type AggregateStat } from '@/lib/player-stats';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FormStrip, type FormResult } from '@/components/FormStrip';
import { PlayerFUTCard } from '@/components/PlayerFUTCard';
import { fetchInFormStatus, type InFormStatus } from '@/lib/in-form';
import { MatchHistoryRow } from '@/components/MatchHistoryRow';
import { StarRating } from '@/components/StarRating';
import { Ionicons } from '@expo/vector-icons';
import { AchievementUnlockModal } from '@/components/AchievementUnlockModal';
import { colors } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { ADMIN_EMAIL } from '@/lib/admin';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';

function tasteLabel(winPct: number, matches: number): string {
  if (matches < 3) return 'Sem dados ainda';
  if (winPct >= 70) return 'Em fogo';
  if (winPct >= 55) return 'A subir';
  if (winPct >= 40) return 'Equilibrado';
  if (winPct >= 25) return 'Em construção';
  return 'A reerguer-se';
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sports, setSports] = useState<UserSportElo[]>([]);
  const [aggregate, setAggregate] = useState<ReviewAggregate | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [mvpCount, setMvpCount] = useState(0);
  const [inForm, setInForm] = useState<InFormStatus | null>(null);
  const [detailedHistory, setDetailedHistory] = useState<DetailedMatchHistoryEntry[]>([]);
  const [isCaptain, setIsCaptain] = useState(false);
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [yearStats, setYearStats] = useState<YearStats[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selfSummary, setSelfSummary] = useState<SelfRatingSummary | null>(null);
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);
  const [unlockedToast, setUnlockedToast] = useState<Achievement | null>(null);
  const [playerStats, setPlayerStats] = useState<AggregateStat[]>([]);
  const [primaryTeamName, setPrimaryTeamName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);


  const load = useCallback(async () => {
    if (!session) return;
    const [p, s, a, h, mvp, myTeams, ss, srs, ifs, dh, ys] = await Promise.all([
      fetchProfile(session.user.id),
      fetchUserSports(session.user.id),
      fetchReviewAggregate(session.user.id),
      fetchUserMatchHistory(session.user.id, 100),
      fetchMvpCount(session.user.id),
      fetchMyTeams(session.user.id),
      fetchSeasonStats(session.user.id),
      fetchMySelfRatingSummary(),
      fetchInFormStatus(session.user.id),
      fetchDetailedMatchHistory(session.user.id, 5),
      fetchPlayerYearStats(session.user.id),
    ]);
    const sportF7 = s.find((x) => x.sport_id === 2) ?? s[0] ?? null;
    const position = sportF7?.preferred_position ?? null;
    const ps = await fetchPlayerStats(session.user.id, position);
    setProfile(p);
    setSports(s);
    setAggregate(a);
    setHistory(h);
    setMvpCount(mvp);
    setIsCaptain(myTeams.some((t) => t.captain_id === session.user.id));
    setSeasonStats(ss);
    setSelfSummary(srs);
    setPlayerStats(ps);
    setPrimaryTeamName(myTeams[0]?.name ?? null);
    setInForm(ifs);
    setDetailedHistory(dh);
    setYearStats(ys);
    if (ys.length > 0 && selectedYear === null) {
      setSelectedYear(ys[0]!.year);
    }
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

  // Detect newly unlocked achievements since last seen, show celebration once.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const streak = computeWinStreak(history);
      const all = computeAchievements({
        history,
        mvpCount,
        isCaptain,
        currentStreak: streak.current,
        bestStreak: streak.best,
      });
      const unlockedIds = all.filter((a) => a.unlocked).map((a) => a.id);
      if (unlockedIds.length === 0) return;
      const raw = await AsyncStorage.getItem('s7vn:seen_achievements');
      const seen: string[] = raw ? JSON.parse(raw) : [];
      const fresh = unlockedIds.filter((id) => !seen.includes(id));
      if (fresh.length === 0) return;
      const ach = all.find((a) => a.id === fresh[0]);
      if (cancelled || !ach) return;
      setUnlockedToast(ach);
      // Mark ALL currently unlocked as seen, so we don't re-fire later for
      // others in the queue; the celebration shows the first only.
      await AsyncStorage.setItem(
        's7vn:seen_achievements',
        JSON.stringify(unlockedIds),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, history, mvpCount, isCaptain]);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
          />
        }
      >
        {loading ? (
          <ProfileSkeleton />
        ) : (
          <>
            <Animated.View
              entering={FadeInDown.duration(300).springify()}
              style={styles.headerBlock}
            >
              {profile && (
                <PlayerFUTCard
                  profile={profile}
                  stats={playerStats}
                  position={sports[0]?.preferred_position ?? null}
                  winPct={
                    sports[0]?.win_matches && sports[0].win_matches > 0
                      ? Math.round(sports[0].win_pct)
                      : null
                  }
                  matches={seasonStats?.matches_played ?? 0}
                  goals={seasonStats?.goals ?? 0}
                  assists={seasonStats?.assists ?? 0}
                  teamName={primaryTeamName}
                  form={history.slice(0, 5).map((h) => h.result).reverse()}
                  inForm={!!inForm}
                  onPress={() => router.push('/(app)/profile/card')}
                />
              )}
              {(() => {
                const s = sports[0];
                if (!s) return null;
                const hasComp = s.comp_matches > 0;
                const hasPel = s.pel_matches > 0;
                if (!hasComp && !hasPel) return null;
                return (
                  <View style={styles.splitRow}>
                    <View style={[styles.splitCell, !hasComp && styles.splitCellDim]}>
                      <Text style={styles.splitLabel}>Amigáveis</Text>
                      <Text style={styles.splitValue}>
                        {hasComp ? `${Math.round(s.comp_win_pct)}%` : '—'}
                      </Text>
                      <Text style={styles.splitMeta}>
                        {`${s.comp_matches} jogo${s.comp_matches === 1 ? '' : 's'}`}
                      </Text>
                    </View>
                    <View style={[styles.splitCell, !hasPel && styles.splitCellDim]}>
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

              {profile?.bio && (
                <Text style={styles.bioText}>{profile.bio}</Text>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button
                  label="Editar perfil"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/(app)/profile/edit')}
                />
                <Button
                  label="↗ Partilhar card"
                  variant="secondary"
                  size="sm"
                  onPress={() => router.push('/(app)/profile/card')}
                />
              </View>
              <View style={{ marginTop: 8 }}>
                <Button
                  label="🤝 Convidar amigos para a S7VN"
                  variant="ghost"
                  size="sm"
                  full
                  onPress={async () => {
                    const firstName = (profile?.name ?? '').split(' ')[0];
                    const { fetchMyTeams } = await import('@/lib/teams');
                    const myTeams = session
                      ? await fetchMyTeams(session.user.id)
                      : [];
                    const myCapTeam = myTeams.find(
                      (t) =>
                        t.captain_id === session?.user.id ||
                        (session?.user.id &&
                          t.sub_captain_ids.includes(session.user.id)),
                    );
                    const code = myCapTeam?.invite_code?.toUpperCase();
                    const teamName = myCapTeam?.name;
                    const lines = [
                      firstName
                        ? `${firstName} chamou-te para a S7VN`
                        : 'Junta-te à S7VN',
                      '',
                      teamName && code
                        ? `Entra na equipa "${teamName}" com o código ${code}.`
                        : 'Marca jogos de S7VN com a tua equipa, avalia colegas e sobe no ranking de Coimbra.',
                      '',
                      'Instala em jogadalimpa.app',
                      ...(code
                        ? [
                            '',
                            `Já tens a app? Abre: jogadalimpa://teams/join?code=${code}`,
                          ]
                        : []),
                    ];
                    try {
                      await Share.share({ message: lines.join('\n') });
                    } catch {}
                  }}
                />
              </View>
            </Animated.View>

            {yearStats.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(100).springify()}
                style={styles.section}
              >
                <Eyebrow>Estatísticas por época</Eyebrow>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.yearChipsRow}
                >
                  {yearStats.map((y) => {
                    const active = selectedYear === y.year;
                    return (
                      <Pressable
                        key={y.year}
                        onPress={() => setSelectedYear(y.year)}
                        style={[
                          styles.yearChip,
                          active && styles.yearChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.yearChipText,
                            active && styles.yearChipTextActive,
                          ]}
                        >
                          {y.year}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {(() => {
                  const y = yearStats.find((x) => x.year === selectedYear) ?? yearStats[0];
                  if (!y) return null;
                  return (
                    <Card style={{ marginTop: 12 }}>
                      <View style={styles.seasonRow}>
                        <View style={styles.seasonCell}>
                          <Text style={styles.seasonValue}>
                            {y.matches_played}
                          </Text>
                          <Text style={styles.seasonLabel}>
                            {y.matches_played === 1 ? 'jogo' : 'jogos'}
                          </Text>
                        </View>
                        <View style={styles.seasonCell}>
                          <Text style={[styles.seasonValue, { color: '#fbbf24' }]}>
                            {y.goals}
                          </Text>
                          <Text style={styles.seasonLabel}>Golos</Text>
                        </View>
                        <View style={styles.seasonCell}>
                          <Text style={[styles.seasonValue, { color: '#34d399' }]}>
                            {y.assists}
                          </Text>
                          <Text style={styles.seasonLabel}>Assistências</Text>
                        </View>
                      </View>
                      <View style={styles.yearRecord}>
                        <Text style={styles.yearRecordText}>
                          {`${y.wins}V · ${y.draws}E · ${y.losses}D`}
                        </Text>
                      </View>
                    </Card>
                  );
                })()}
              </Animated.View>
            )}

            {selfSummary && selfSummary.rated_matches > 0 && (
              <Animated.View
                entering={FadeInDown.delay(120).springify()}
                style={styles.section}
              >
                <Eyebrow>Auto-avaliação</Eyebrow>
                <Card style={{ marginTop: 8 }}>
                  <View style={styles.selfRow}>
                    <View style={styles.selfCell}>
                      <Text style={styles.selfValue}>
                        {Number(selfSummary.avg_self).toFixed(1)}
                      </Text>
                      <Text style={styles.selfLabel}>O que dei</Text>
                    </View>
                    <View style={styles.selfCell}>
                      <Text style={styles.selfValue}>
                        {Number(selfSummary.avg_others).toFixed(1)}
                      </Text>
                      <Text style={styles.selfLabel}>O que recebi</Text>
                    </View>
                    <View style={styles.selfCell}>
                      <Text
                        style={[
                          styles.selfValue,
                          {
                            color:
                              Number(selfSummary.avg_delta) > 0.5
                                ? '#fb923c'
                                : Number(selfSummary.avg_delta) < -0.5
                                  ? '#34d399'
                                  : colors.text,
                          },
                        ]}
                      >
                        {Number(selfSummary.avg_delta) > 0 ? '+' : ''}
                        {Number(selfSummary.avg_delta).toFixed(1)}
                      </Text>
                      <Text style={styles.selfLabel}>Delta</Text>
                    </View>
                  </View>
                  {selfSummary.divergent_matches > 0 && (
                    <Text style={styles.selfFootnote}>
                      {`${selfSummary.divergent_matches} jogo${selfSummary.divergent_matches === 1 ? '' : 's'} com discrepância significativa`}
                    </Text>
                  )}
                </Card>
              </Animated.View>
            )}


            <Animated.View
              entering={FadeInDown.delay(130).springify()}
              style={styles.section}
            >
              <View style={styles.sectionHeader}>
                <Eyebrow>Histórico</Eyebrow>
                {session && detailedHistory.length > 0 && (
                  <Pressable
                    onPress={() =>
                      router.push(`/(app)/users/${session.user.id}/matches`)
                    }
                    style={styles.seeAllBtn}
                  >
                    <Text style={styles.seeAllText}>Ver todos</Text>
                    <Ionicons name="arrow-forward" size={12} color={colors.brand} />
                  </Pressable>
                )}
              </View>
              {detailedHistory.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>Sem jogos validados ainda.</Text>
                </Card>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {detailedHistory.map((m) => (
                    <MatchHistoryRow
                      key={m.match_id}
                      m={m}
                      onPress={() =>
                        router.push(`/(app)/matches/${m.match_id}`)
                      }
                    />
                  ))}
                </View>
              )}
            </Animated.View>

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
                  <Eyebrow>Recordes pessoais</Eyebrow>
                  <Card style={{ marginTop: 8 }}>
                    {records.biggest_win && (
                      <View style={styles.recordRow}>
                        <Text style={styles.recordIcon}>🥇</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordLabel}>Maior vitória</Text>
                          <Text style={styles.recordValue}>
                            {`+${records.biggest_win.margin} vs ${records.biggest_win.opponent}`}
                          </Text>
                        </View>
                      </View>
                    )}
                    {records.biggest_loss && (
                      <View style={styles.recordRow}>
                        <Text style={styles.recordIcon}>💔</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordLabel}>Pior derrota</Text>
                          <Text style={styles.recordValue}>
                            {`-${records.biggest_loss.margin} vs ${records.biggest_loss.opponent}`}
                          </Text>
                        </View>
                      </View>
                    )}
                    {records.longest_streak > 0 && (
                      <View style={styles.recordRow}>
                        <Text style={styles.recordIcon}>🔥</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordLabel}>Melhor sequência</Text>
                          <Text style={styles.recordValue}>
                            {`${records.longest_streak} vitórias seguidas`}
                          </Text>
                        </View>
                      </View>
                    )}
                    {records.most_in_month && records.most_in_month.count > 1 && (
                      <View style={styles.recordRow}>
                        <Text style={styles.recordIcon}>📅</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordLabel}>Mês mais activo</Text>
                          <Text style={styles.recordValue}>
                            {`${records.most_in_month.count} jogos (${records.most_in_month.month})`}
                          </Text>
                        </View>
                      </View>
                    )}
                  </Card>
                </Animated.View>
              );
            })()}

            <Animated.View
              entering={FadeInDown.delay(190).springify()}
              style={styles.section}
            >
              <Eyebrow>Conquistas</Eyebrow>
              {(() => {
                const streak = computeWinStreak(history);
                const achievements = computeAchievements({
                  history,
                  mvpCount,
                  isCaptain,
                  currentStreak: streak.current,
                  bestStreak: streak.best,
                });
                return (
                  <View style={styles.achGrid}>
                    {achievements.map((a) => {
                      const pct =
                        a.progress && a.progress.target > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (a.progress.current / a.progress.target) *
                                  100,
                              ),
                            )
                          : null;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => setSelectedAch(a)}
                          style={[
                            styles.ach,
                            !a.unlocked && styles.achLocked,
                          ]}
                        >
                          <Text
                            style={[
                              styles.achEmoji,
                              !a.unlocked && styles.achEmojiLocked,
                            ]}
                          >
                            {a.emoji}
                          </Text>
                          <Text
                            style={[
                              styles.achTitle,
                              !a.unlocked && styles.achTitleLocked,
                            ]}
                            numberOfLines={1}
                          >
                            {a.title}
                          </Text>
                          {!a.unlocked && pct !== null && pct > 0 && (
                            <View style={styles.achProgressTrack}>
                              <View
                                style={[
                                  styles.achProgressFill,
                                  { width: `${pct}%` },
                                ]}
                              />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })()}
            </Animated.View>

            {aggregate && (
              <Animated.View
                entering={FadeInDown.delay(210).springify()}
                style={styles.section}
              >
                <Eyebrow>Reputação</Eyebrow>
                <Card style={{ marginTop: 8 }}>
                  <View style={styles.starsHero}>
                    <StarRating value={aggregate.avg_overall ?? 0} size={28} />
                    <Text style={styles.starsHeroValue}>
                      {(aggregate.avg_overall ?? 0).toFixed(1)}
                    </Text>
                  </View>
                  <Text style={styles.aggFoot}>
                    {`${aggregate.total_reviews} avaliação(ões) recebidas`}
                  </Text>
                </Card>
              </Animated.View>
            )}

            {session?.user.email === ADMIN_EMAIL && (
              <Animated.View
                entering={FadeInDown.delay(260).springify()}
                style={{ marginTop: 24 }}
              >
                <Button
                  label="Admin · Waitlist"
                  variant="secondary"
                  onPress={() => router.push('/(app)/admin/waitlist')}
                  full
                />
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(300).springify()}
              style={{ marginTop: 24, alignItems: 'center' }}
            >
              <Button
                label="Sair"
                variant="ghost"
                size="sm"
                haptic="none"
                onPress={async () => {
                  await signOut();
                  router.replace('/(auth)/login');
                }}
              />
            </Animated.View>
          </>
        )}
      </ScrollView>

      <AchievementUnlockModal
        achievement={unlockedToast}
        onClose={() => setUnlockedToast(null)}
      />

      <Modal
        visible={selectedAch !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedAch(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedAch(null)}>
          <View style={styles.achModalBg}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.achModal,
                  selectedAch?.unlocked
                    ? styles.achModalUnlocked
                    : styles.achModalLocked,
                ]}
              >
                <Text
                  style={[
                    styles.achModalEmoji,
                    !selectedAch?.unlocked && { opacity: 0.4 },
                  ]}
                >
                  {selectedAch?.emoji ?? ''}
                </Text>
                <Text style={styles.achModalTitle}>
                  {selectedAch?.title ?? ''}
                </Text>
                <Text style={styles.achModalDesc}>
                  {selectedAch?.description ?? ''}
                </Text>
                {!selectedAch?.unlocked &&
                  selectedAch?.progress &&
                  selectedAch.progress.target > 0 && (
                    <View style={styles.achProgressWrap}>
                      <View style={styles.achProgressTrack}>
                        <View
                          style={[
                            styles.achProgressFill,
                            {
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (selectedAch.progress.current /
                                    selectedAch.progress.target) *
                                    100,
                                ),
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.achProgressText}>
                        {`${selectedAch.progress.current} / ${selectedAch.progress.target}`}
                      </Text>
                    </View>
                  )}
                <View
                  style={[
                    styles.achModalStatus,
                    {
                      backgroundColor: selectedAch?.unlocked
                        ? 'rgba(201,162,107,0.18)'
                        : 'rgba(255,255,255,0.06)',
                      borderColor: selectedAch?.unlocked
                        ? 'rgba(201,162,107,0.4)'
                        : 'rgba(255,255,255,0.12)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.achModalStatusText,
                      {
                        color: selectedAch?.unlocked ? '#C9A26B' : colors.textDim,
                      },
                    ]}
                  >
                    {selectedAch?.unlocked ? '✓ Desbloqueado' : '🔒 Por desbloquear'}
                  </Text>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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

function ProfileSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 12, marginTop: 32 }}>
        <Skeleton width={96} height={96} radius={48} />
        <Skeleton width={180} height={28} />
        <Skeleton width={120} height={14} />
      </View>
      <Skeleton height={80} radius={16} style={{ marginTop: 24 }} />
      <Skeleton height={140} radius={16} />
      <Skeleton height={80} radius={16} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 120 },
  headerBlock: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 16,
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
  email: { color: colors.textFaint, fontSize: 12, marginBottom: 12 },
  bioText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 8,
  },
  formRow: { marginTop: 12, alignItems: 'center' },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  recordIcon: { fontSize: 24 },
  recordLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recordValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  achModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  achModal: {
    width: '100%',
    maxWidth: 320,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#0f1a14',
    borderWidth: 1,
    alignItems: 'center',
  },
  achModalUnlocked: { borderColor: 'rgba(201,162,107,0.5)' },
  achModalLocked: { borderColor: 'rgba(255,255,255,0.15)' },
  achModalEmoji: { fontSize: 64 },
  achModalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 12,
    textAlign: 'center',
  },
  achModalDesc: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  achModalStatus: {
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  achModalStatusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  achProgressWrap: { marginTop: 18, width: '100%' },
  achProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  achProgressFill: {
    height: '100%',
    backgroundColor: '#C9A26B',
    borderRadius: 3,
  },
  achProgressText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 6,
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
  splitCellDim: { opacity: 0.5 },
  splitLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  splitLabelGold: { color: colors.goldDeep },
  splitValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: 6,
    lineHeight: 34,
  },
  splitValueGold: { color: colors.goldDeep },
  splitMeta: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  achGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  ach: {
    width: '30.5%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
  },
  achLocked: {
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  achEmoji: { fontSize: 26 },
  achEmojiLocked: { opacity: 0.25 },
  achTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  achTitleLocked: { color: colors.textDim },
  section: { marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2, letterSpacing: -0.1 },
  elo: { color: '#ffffff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  eloSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eloCurrent: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  eloDelta: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  eloHint: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  eloFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  eloFooterText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  yearChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  yearChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  yearChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  yearChipTextActive: {
    color: colors.brand,
  },
  yearRecord: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  yearRecordText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
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
  selfRow: { flexDirection: 'row' },
  selfCell: { flex: 1, alignItems: 'center' },
  selfValue: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  selfLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  selfFootnote: {
    color: '#fb923c',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
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
});
