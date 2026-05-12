import { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
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
  computeWinStreak,
  fetchUserMatchHistory,
  type MatchHistoryEntry,
} from '@/lib/history';
import { formatMatchDate } from '@/lib/matches';
import { fetchMvpCount } from '@/lib/mvp';
import { fetchMyTeams } from '@/lib/teams';
import { computeAchievements } from '@/lib/achievements';
import {
  fetchEloHistory,
  summariseEloHistory,
  type EloHistoryPoint,
} from '@/lib/elo-history';
import { EloChart } from '@/components/EloChart';
import { fetchSeasonStats, type SeasonStats } from '@/lib/season-stats';
import {
  fetchMySelfRatingSummary,
  type SelfRatingSummary,
} from '@/lib/self-rating';
import { FormStrip, type FormResult } from '@/components/FormStrip';
import { colors } from '@/theme';
import { Avatar } from '@/components/Avatar';
import { ADMIN_EMAIL } from '@/lib/admin';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';

function levelLabel(elo: number): string {
  if (elo < 1100) return 'Casual';
  if (elo < 1300) return 'Intermédio';
  if (elo < 1500) return 'Avançado';
  return 'Competitivo';
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sports, setSports] = useState<UserSportElo[]>([]);
  const [aggregate, setAggregate] = useState<ReviewAggregate | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [mvpCount, setMvpCount] = useState(0);
  const [isCaptain, setIsCaptain] = useState(false);
  const [eloHistory, setEloHistory] = useState<EloHistoryPoint[]>([]);
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null);
  const [selfSummary, setSelfSummary] = useState<SelfRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const [p, s, a, h, mvp, myTeams, eh, ss, srs] = await Promise.all([
      fetchProfile(session.user.id),
      fetchUserSports(session.user.id),
      fetchReviewAggregate(session.user.id),
      fetchUserMatchHistory(session.user.id, 100),
      fetchMvpCount(session.user.id),
      fetchMyTeams(session.user.id),
      fetchEloHistory(session.user.id, undefined, 30),
      fetchSeasonStats(session.user.id),
      fetchMySelfRatingSummary(),
    ]);
    setProfile(p);
    setSports(s);
    setAggregate(a);
    setHistory(h);
    setMvpCount(mvp);
    setIsCaptain(myTeams.some((t) => t.captain_id === session.user.id));
    setEloHistory(eh);
    setSeasonStats(ss);
    setSelfSummary(srs);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ProfileSkeleton />
        ) : (
          <>
            <Animated.View
              entering={FadeInDown.duration(300).springify()}
              style={styles.headerBlock}
            >
              <View style={styles.avatarRow}>
                <Avatar
                  url={profile?.photo_url}
                  name={profile?.name}
                  size={96}
                />
                {profile?.jersey_number !== null && profile?.jersey_number !== undefined && (
                  <View style={styles.jerseyBadge}>
                    <Text style={styles.jerseyText}>{profile.jersey_number}</Text>
                  </View>
                )}
              </View>
              <Heading level={1} style={{ marginTop: 16, textAlign: 'center' }}>
                {profile ? formatDisplayName(profile) : ''}
              </Heading>
              <Text style={styles.city}>
                {profile?.city}
                {profile?.preferred_foot ? ` · ${FOOT_LABEL[profile.preferred_foot]}` : ''}
              </Text>
              <Text style={styles.email}>{session?.user.email}</Text>

              {(() => {
                const streak = computeWinStreak(history);
                const lastFive: FormResult[] = history
                  .slice(0, 5)
                  .map((h) => h.result as FormResult)
                  .reverse();
                const showBadges = streak.current >= 2 || mvpCount > 0;
                return (
                  <>
                    {lastFive.length > 0 && (
                      <View style={styles.formRow}>
                        <FormStrip results={lastFive} size="sm" />
                      </View>
                    )}
                    {showBadges && (
                      <View style={styles.badgeRow}>
                        {streak.current >= 2 && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {`🔥 ${streak.current} vitórias seguidas`}
                            </Text>
                          </View>
                        )}
                        {mvpCount > 0 && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                              {`👑 ${mvpCount} MVP${mvpCount === 1 ? '' : 's'}`}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                );
              })()}

              <Button
                label="Editar perfil"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/(app)/profile/edit')}
              />
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

            {seasonStats && seasonStats.matches_played > 0 && (
              <Animated.View
                entering={FadeInDown.delay(100).springify()}
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

            {selfSummary && selfSummary.rated_matches > 0 && (
              <Animated.View
                entering={FadeInDown.delay(120).springify()}
                style={styles.section}
              >
                <Eyebrow>🪞 Auto-avaliação</Eyebrow>
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

            {eloHistory.length >= 2 && (() => {
              const summary = summariseEloHistory(eloHistory);
              const deltaSign =
                summary.delta_30d > 0
                  ? '+'
                  : summary.delta_30d < 0
                    ? ''
                    : '±';
              const deltaColor =
                summary.delta_30d > 0
                  ? '#34d399'
                  : summary.delta_30d < 0
                    ? '#f87171'
                    : colors.textDim;
              return (
                <Animated.View
                  entering={FadeInDown.delay(110).springify()}
                  style={styles.section}
                >
                  <Eyebrow>Evolução do ELO</Eyebrow>
                  <Card style={{ marginTop: 8 }}>
                    <View style={styles.eloSummaryRow}>
                      <View>
                        <Text style={styles.eloCurrent}>{summary.current}</Text>
                        <Text style={styles.eloHint}>Atual</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.eloDelta, { color: deltaColor }]}>
                          {`${deltaSign}${summary.delta_30d}`}
                        </Text>
                        <Text style={styles.eloHint}>30 dias</Text>
                      </View>
                    </View>
                    <View style={{ marginTop: 16 }}>
                      <EloChart points={eloHistory} />
                    </View>
                    <View style={styles.eloFooter}>
                      <Text style={styles.eloFooterText}>
                        {`Pico ${summary.peak} · Melhor +${summary.best_win} · Pior ${summary.worst_loss}`}
                      </Text>
                    </View>
                  </Card>
                </Animated.View>
              );
            })()}

            <Animated.View
              entering={FadeInDown.delay(140).springify()}
              style={styles.section}
            >
              <Eyebrow>Reputação</Eyebrow>
              {aggregate ? (
                <Card style={{ marginTop: 8 }}>
                  <AggBar label="Fair play" value={aggregate.avg_fair_play} />
                  <AggBar
                    label="Pontualidade"
                    value={aggregate.avg_punctuality}
                  />
                  <AggBar
                    label="Nível técnico"
                    value={aggregate.avg_technical_level}
                  />
                  <AggBar label="Atitude" value={aggregate.avg_attitude} />
                  <Text style={styles.aggFoot}>
                    {`${aggregate.total_reviews} avaliação(ões) recebidas`}
                  </Text>
                </Card>
              ) : (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>
                    Em construção — joga mais jogos para ver a tua reputação.
                  </Text>
                </Card>
              )}
            </Animated.View>

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
                    {achievements.map((a) => (
                      <View
                        key={a.id}
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
                      </View>
                    ))}
                  </View>
                );
              })()}
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(220).springify()}
              style={styles.section}
            >
              <Eyebrow>Histórico</Eyebrow>
              {history.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>Sem jogos validados ainda.</Text>
                </Card>
              ) : (
                history.map((h) => (
                  <Card
                    key={h.match_id}
                    onPress={() => router.push(`/(app)/matches/${h.match_id}`)}
                    style={{ marginTop: 8 }}
                  >
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>
                          {`${h.my_team_name} vs ${h.opponent_team_name}`}
                        </Text>
                        <Text style={styles.rowMeta}>
                          {`${h.sport_name} · ${formatMatchDate(h.scheduled_at)}`}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text
                          style={[
                            styles.score,
                            h.result === 'win' && styles.win,
                            h.result === 'loss' && styles.loss,
                          ]}
                        >
                          {h.my_side === 'A'
                            ? `${h.final_score_a}–${h.final_score_b}`
                            : `${h.final_score_b}–${h.final_score_a}`}
                        </Text>
                        <Text style={styles.resultLabel}>
                          {h.result === 'win'
                            ? 'V'
                            : h.result === 'loss'
                              ? 'D'
                              : 'E'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </Animated.View>

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
  scroll: { padding: 24, paddingBottom: 48 },
  headerBlock: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: 16,
  },
  city: { color: '#a3a3a3', fontSize: 14, letterSpacing: -0.1 },
  avatarRow: { position: 'relative' },
  jerseyBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 32,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    borderWidth: 3,
    borderColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: {
    color: '#0a0a0a',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  email: { color: '#5a5a5a', fontSize: 12, marginBottom: 12 },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 8,
  },
  formRow: { marginTop: 12, alignItems: 'center' },
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
  rowMeta: { color: '#a3a3a3', fontSize: 12, marginTop: 2, letterSpacing: -0.1 },
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
    color: '#737373',
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
    color: '#a3a3a3',
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: -0.1,
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
  selfRow: { flexDirection: 'row' },
  selfCell: { flex: 1, alignItems: 'center' },
  selfValue: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  selfLabel: {
    color: '#a3a3a3',
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
