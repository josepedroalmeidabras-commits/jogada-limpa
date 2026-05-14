import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  acceptMatch,
  fetchMatchById,
  formatMatchDate,
  isMatchParticipant,
  rejectMatch,
  setMyMatchAvailability,
  statusLabel,
  type MatchSummary,
} from '@/lib/matches';
import { addMatchToCalendar } from '@/lib/calendar';
import { fetchMatchUnreadCount } from '@/lib/match-chat';
import { fetchHeadToHead, type HeadToHead } from '@/lib/h2h';
import { supabase } from '@/lib/supabase';
import { fetchReferee, type RefereeProfile } from '@/lib/referee';
import { Avatar } from '@/components/Avatar';
import {
  fetchMatchParticipants,
  type MatchParticipant,
} from '@/lib/result';
import { markParticipantPaid, respondToMatchInvite } from '@/lib/internal-match';
import { fetchMatchMvpWinner, type MvpWinner } from '@/lib/mvp';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { MatchPhotoStrip } from '@/components/MatchPhotoStrip';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [h2h, setH2h] = useState<HeadToHead | null>(null);
  const [preview, setPreview] = useState<{
    a: { win_pct: number; matches: number; wins: number; draws: number; losses: number };
    b: { win_pct: number; matches: number; wins: number; draws: number; losses: number };
  } | null>(null);
  const [referee, setReferee] = useState<RefereeProfile | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [mvp, setMvp] = useState<MvpWinner | null>(null);
  const [respondBusy, setRespondBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const m = await fetchMatchById(id);
    setMatch(m);
    if (m && session) {
      const needsParticipants =
        m.is_internal ||
        m.status === 'validated' ||
        m.status === 'proposed' ||
        m.status === 'confirmed' ||
        m.status === 'result_pending';
      const [part, unread, hh, ref, parts, mvpWin] = await Promise.all([
        isMatchParticipant(m.id, session.user.id),
        fetchMatchUnreadCount(m.id, session.user.id),
        fetchHeadToHead(m.side_a.id, m.side_b.id),
        m.referee_id ? fetchReferee(m.referee_id) : Promise.resolve(null),
        needsParticipants
          ? fetchMatchParticipants(m.id)
          : Promise.resolve<MatchParticipant[]>([]),
        m.status === 'validated'
          ? fetchMatchMvpWinner(m.id)
          : Promise.resolve<MvpWinner | null>(null),
      ]);
      setIsParticipant(part);
      setChatUnread(unread);
      setH2h(hh);
      setReferee(ref);
      setParticipants(parts);
      setMvp(mvpWin);

      // Pre-game preview: fetch team_win_stats for both sides when not internal
      if (!m.is_internal && m.status !== 'validated') {
        const { data: rows } = await supabase
          .from('team_win_stats')
          .select('team_id, win_pct, wins, draws, losses, matches')
          .in('team_id', [m.side_a.id, m.side_b.id])
          .eq('sport_id', m.sport_id);
        const ra = (rows ?? []).find((r: any) => r.team_id === m.side_a.id) as
          | any
          | undefined;
        const rb = (rows ?? []).find((r: any) => r.team_id === m.side_b.id) as
          | any
          | undefined;
        setPreview({
          a: {
            win_pct: Number(ra?.win_pct ?? 0),
            matches: ra?.matches ?? 0,
            wins: ra?.wins ?? 0,
            draws: ra?.draws ?? 0,
            losses: ra?.losses ?? 0,
          },
          b: {
            win_pct: Number(rb?.win_pct ?? 0),
            matches: rb?.matches ?? 0,
            wins: rb?.wins ?? 0,
            draws: rb?.draws ?? 0,
            losses: rb?.losses ?? 0,
          },
        });
      } else {
        setPreview(null);
      }
    }
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleAccept() {
    if (!match) return;
    setError(null);
    setActing(true);
    const r = await acceptMatch(match.id);
    setActing(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    await load();
  }

  async function handleReject() {
    if (!match) return;
    setError(null);
    setActing(true);
    const r = await rejectMatch(match.id);
    setActing(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <Screen>
        <View style={{ padding: 24, gap: 12 }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={140} radius={16} style={{ marginTop: 12 }} />
          <Skeleton height={48} radius={999} />
        </View>
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text style={{ color: colors.textMuted }}>Jogo não encontrado.</Text>
          <Button label="Voltar" variant="secondary" onPress={() => router.replace('/(app)')} />
        </View>
      </Screen>
    );
  }

  const isCaptainA = match.side_a.captain_id === session?.user.id;
  const isCaptainB = match.side_b.captain_id === session?.user.id;
  const isCaptain = isCaptainA || isCaptainB;
  const canAccept = match.status === 'proposed' && isCaptainB;
  const canReject = match.status === 'proposed' && isCaptain;
  const canSubmitResult =
    isCaptain &&
    (match.status === 'confirmed' ||
      match.status === 'result_pending' ||
      match.status === 'disputed');
  const canReview = match.status === 'validated' && isParticipant;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Jogo',
          headerStyle: { backgroundColor: '#0E1812' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          {(() => {
            const diff =
              new Date(match.scheduled_at).getTime() - Date.now();
            const isLive =
              match.status === 'confirmed' &&
              diff <= 0 &&
              diff > -4 * 60 * 60 * 1000;
            if (!isLive) return null;
            const elapsedMin = Math.max(1, Math.floor(-diff / 60_000));
            return (
              <View style={styles.liveBanner}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  AO VIVO · {elapsedMin}MIN
                </Text>
              </View>
            );
          })()}
          <Card variant="hero">
            {match.is_internal && (
              <View style={styles.internalBanner}>
                <Ionicons name="flame" size={12} color={colors.goldDeep} />
                <Text style={styles.internalBannerText}>
                  {`Peladinha · ${match.side_a.name}`}
                </Text>
              </View>
            )}
            <View style={styles.scoreSplit}>
              <SidePillar
                name={match.is_internal && match.side_a_label
                  ? match.side_a_label
                  : match.side_a.name}
                photoUrl={match.side_a.photo_url}
                score={match.final_score_a}
                winner={
                  match.final_score_a !== null &&
                  match.final_score_b !== null &&
                  match.final_score_a > match.final_score_b
                }
                onPress={() => router.push(`/(app)/teams/${match.side_a.id}`)}
              />
              <Text style={styles.scoreSeparator}>
                {match.final_score_a !== null && match.final_score_b !== null
                  ? '·'
                  : 'vs'}
              </Text>
              <SidePillar
                name={match.is_internal && match.side_b_label
                  ? match.side_b_label
                  : match.side_b.name}
                photoUrl={match.side_b.photo_url}
                score={match.final_score_b}
                winner={
                  match.final_score_a !== null &&
                  match.final_score_b !== null &&
                  match.final_score_b > match.final_score_a
                }
                onPress={() => router.push(`/(app)/teams/${match.side_b.id}`)}
              />
            </View>
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <StatusBadge status={match.status} />
            </View>
          </Card>
        </Animated.View>

        {match.status === 'validated' && (() => {
          const topGoal = participants
            .filter((p) => p.goals > 0)
            .sort((a, b) => b.goals - a.goals)[0];
          const topAssist = participants
            .filter((p) => p.assists > 0)
            .sort((a, b) => b.assists - a.assists)[0];
          if (!mvp && !topGoal && !topAssist) return null;
          return (
            <Animated.View
              entering={FadeInDown.delay(70).springify()}
              style={styles.section}
            >
              <Text style={styles.recapLabel}>Recap</Text>
              <View style={styles.recapRow}>
                {mvp && (
                  <Pressable
                    onPress={() => router.push(`/(app)/users/${mvp.user_id}`)}
                    style={styles.recapCell}
                  >
                    <Avatar
                      url={mvp.photo_url}
                      name={mvp.name}
                      size={44}
                    />
                    <Text style={styles.recapCellLabel}>MVP</Text>
                    <Text style={styles.recapCellName} numberOfLines={1}>
                      {mvp.name.split(' ')[0]}
                    </Text>
                    <Text style={styles.recapCellMeta}>
                      {`${mvp.votes} voto${mvp.votes === 1 ? '' : 's'}`}
                    </Text>
                  </Pressable>
                )}
                {topGoal && (
                  <Pressable
                    onPress={() =>
                      router.push(`/(app)/users/${topGoal.user_id}`)
                    }
                    style={styles.recapCell}
                  >
                    <Avatar
                      url={topGoal.profile?.photo_url ?? null}
                      name={topGoal.profile?.name ?? '?'}
                      size={44}
                    />
                    <Text style={styles.recapCellLabel}>Goleador</Text>
                    <Text style={styles.recapCellName} numberOfLines={1}>
                      {(topGoal.profile?.name ?? 'Jogador').split(' ')[0]}
                    </Text>
                    <Text style={styles.recapCellMeta}>
                      {`${topGoal.goals} golo${topGoal.goals === 1 ? '' : 's'}`}
                    </Text>
                  </Pressable>
                )}
                {topAssist && (
                  <Pressable
                    onPress={() =>
                      router.push(`/(app)/users/${topAssist.user_id}`)
                    }
                    style={styles.recapCell}
                  >
                    <Avatar
                      url={topAssist.profile?.photo_url ?? null}
                      name={topAssist.profile?.name ?? '?'}
                      size={44}
                    />
                    <Text style={styles.recapCellLabel}>Assistente</Text>
                    <Text style={styles.recapCellName} numberOfLines={1}>
                      {(topAssist.profile?.name ?? 'Jogador').split(' ')[0]}
                    </Text>
                    <Text style={styles.recapCellMeta}>
                      {`${topAssist.assists} ass.`}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          );
        })()}

        {preview && (preview.a.matches > 0 || preview.b.matches > 0) && (
          <Animated.View
            entering={FadeInDown.delay(75).springify()}
            style={styles.section}
          >
            <Eyebrow>Pré-jogo</Eyebrow>
            <Card variant="subtle" style={{ marginTop: 8 }}>
              <View style={styles.previewRow}>
                <View style={styles.previewCell}>
                  <Text
                    style={[
                      styles.previewPct,
                      preview.a.win_pct > preview.b.win_pct && {
                        color: '#C9A26B',
                      },
                    ]}
                  >
                    {preview.a.matches > 0
                      ? `${Math.round(preview.a.win_pct)}%`
                      : '—'}
                  </Text>
                  <Text style={styles.previewRecord}>
                    {`${preview.a.wins}V · ${preview.a.draws}E · ${preview.a.losses}D`}
                  </Text>
                </View>
                <Text style={styles.previewSep}>VS</Text>
                <View style={styles.previewCell}>
                  <Text
                    style={[
                      styles.previewPct,
                      preview.b.win_pct > preview.a.win_pct && {
                        color: '#C9A26B',
                      },
                    ]}
                  >
                    {preview.b.matches > 0
                      ? `${Math.round(preview.b.win_pct)}%`
                      : '—'}
                  </Text>
                  <Text style={styles.previewRecord}>
                    {`${preview.b.wins}V · ${preview.b.draws}E · ${preview.b.losses}D`}
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.section}>
          <Card>
            <InfoRow label="Quando" value={formatMatchDate(match.scheduled_at)} />
            <InfoRow
              label="Onde"
              value={
                match.location_tbd
                  ? 'A combinar'
                  : (match.location_name ?? '—')
              }
            />
            {match.message && <InfoRow label="Mensagem" value={match.message} last />}
          </Card>
        </Animated.View>

        {(() => {
          const attended = participants.filter(
            (p) =>
              p.attendance === 'attended' || p.attendance === 'substitute_in',
          );
          if (attended.length === 0) return null;
          const sideA = attended.filter((p) => p.side === 'A');
          const sideB = attended.filter((p) => p.side === 'B');
          return (
            <Animated.View
              entering={FadeInDown.delay(90).springify()}
              style={styles.section}
            >
              <Eyebrow>{`Plantel · ${attended.length}`}</Eyebrow>
              <Text style={styles.plantelHint}>
                Toca para ver perfil · prime para reportar
              </Text>
              <View style={styles.plantelGrid}>
                <PlantelColumn
                  title={
                    match.is_internal && match.side_a_label
                      ? match.side_a_label
                      : match.side_a.name
                  }
                  players={sideA}
                  meId={session?.user.id ?? null}
                  onPress={(uid) => router.push(`/(app)/users/${uid}`)}
                  onReport={(uid, name) =>
                    openReportSheet(router, match.id, uid, name)
                  }
                />
                <PlantelColumn
                  title={
                    match.is_internal && match.side_b_label
                      ? match.side_b_label
                      : match.side_b.name
                  }
                  players={sideB}
                  meId={session?.user.id ?? null}
                  onPress={(uid) => router.push(`/(app)/users/${uid}`)}
                  onReport={(uid, name) =>
                    openReportSheet(router, match.id, uid, name)
                  }
                />
              </View>
            </Animated.View>
          );
        })()}

        {(referee || (isCaptain && match.status !== 'cancelled')) && (
          <Animated.View
            entering={FadeInDown.delay(95).springify()}
            style={styles.section}
          >
            {referee ? (
              <Card
                onPress={() => router.push(`/(app)/users/${referee.id}`)}
              >
                <View style={styles.refRow}>
                  <Text style={styles.refWhistle}>🥏</Text>
                  <Avatar
                    url={referee.photo_url}
                    name={referee.name}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.refLabel}>Árbitro</Text>
                    <Text style={styles.refName}>{referee.name}</Text>
                  </View>
                  {isCaptain && match.status !== 'validated' && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push(`/(app)/matches/${match.id}/referee`);
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.refEdit}>Mudar ›</Text>
                    </Pressable>
                  )}
                </View>
              </Card>
            ) : (
              <Pressable
                onPress={() =>
                  router.push(`/(app)/matches/${match.id}/referee`)
                }
                style={styles.refAddBtn}
              >
                <Text style={styles.refAddText}>🥏 Adicionar árbitro</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {h2h && h2h.played > 1 && !match.is_internal && (
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={styles.section}
          >
            <Card variant="subtle">
              <Text style={styles.h2hLabel}>Head-to-head</Text>
              <View style={styles.h2hRow}>
                <View style={styles.h2hCell}>
                  <Text style={styles.h2hValue}>{h2h.a_wins}</Text>
                  <Text style={styles.h2hMeta} numberOfLines={1}>
                    {match.side_a.name}
                  </Text>
                </View>
                <View style={styles.h2hCell}>
                  <Text style={[styles.h2hValue, styles.h2hDraws]}>
                    {h2h.draws}
                  </Text>
                  <Text style={styles.h2hMeta}>Empates</Text>
                </View>
                <View style={styles.h2hCell}>
                  <Text style={styles.h2hValue}>{h2h.b_wins}</Text>
                  <Text style={styles.h2hMeta} numberOfLines={1}>
                    {match.side_b.name}
                  </Text>
                </View>
              </View>
              <Text style={styles.h2hFoot}>
                {`${h2h.played} jogos · ${h2h.a_goals}–${h2h.b_goals} no total`}
              </Text>
            </Card>
          </Animated.View>
        )}

        {(match.notes || (isCaptain && match.status !== 'validated' && match.status !== 'cancelled')) && (
          <Animated.View
            entering={FadeInDown.delay(110).springify()}
            style={styles.section}
          >
            <Card
              onPress={
                isCaptain && match.status !== 'validated' && match.status !== 'cancelled'
                  ? () => router.push(`/(app)/matches/${match.id}/notes`)
                  : undefined
              }
            >
              <View style={styles.notesHeader}>
                <Text style={styles.notesLabel}>📝 Notas do jogo</Text>
                {isCaptain &&
                  match.status !== 'validated' &&
                  match.status !== 'cancelled' && (
                    <Text style={styles.notesEdit}>
                      {match.notes ? 'Editar ›' : 'Adicionar ›'}
                    </Text>
                  )}
              </View>
              {match.notes ? (
                <Text style={styles.notesBody}>{match.notes}</Text>
              ) : (
                <Text style={styles.notesEmpty}>
                  Sem notas. Toca para adicionar cor de equipamento, balneário, etc.
                </Text>
              )}
            </Card>
          </Animated.View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {!match.is_internal &&
          isParticipant &&
          !isCaptain &&
          (match.status === 'proposed' ||
            match.status === 'confirmed' ||
            match.status === 'result_pending') && (() => {
          const myRow = participants.find(
            (p) => p.user_id === session?.user.id,
          );
          return (
            <Animated.View
              entering={FadeInDown.delay(125).springify()}
              style={styles.section}
            >
              <Card variant="subtle">
                <Text style={styles.confirmTitle}>A tua presença</Text>
                <View style={styles.confirmActions}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={
                        myRow?.invitation_status === 'accepted'
                          ? '✓ Vou'
                          : 'Vou'
                      }
                      variant={
                        myRow?.invitation_status === 'accepted'
                          ? 'primary'
                          : 'secondary'
                      }
                      size="sm"
                      haptic="light"
                      loading={respondBusy}
                      onPress={async () => {
                        setRespondBusy(true);
                        const r = await setMyMatchAvailability(match.id, true);
                        setRespondBusy(false);
                        if (!r.ok) {
                          Alert.alert('Erro', r.message);
                          return;
                        }
                        await load();
                      }}
                      full
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={
                        myRow?.invitation_status === 'declined'
                          ? '✗ Não vou'
                          : 'Não vou'
                      }
                      variant={
                        myRow?.invitation_status === 'declined'
                          ? 'danger'
                          : 'ghost'
                      }
                      size="sm"
                      loading={respondBusy}
                      onPress={async () => {
                        setRespondBusy(true);
                        const r = await setMyMatchAvailability(match.id, false);
                        setRespondBusy(false);
                        if (!r.ok) {
                          Alert.alert('Erro', r.message);
                          return;
                        }
                        await load();
                      }}
                      full
                    />
                  </View>
                </View>
              </Card>
            </Animated.View>
          );
        })()}

        {isParticipant &&
          (match.status === 'confirmed' || match.status === 'result_pending') &&
          (() => {
            const myPart = participants.find(
              (p) => p.user_id === session?.user.id,
            );
            const reported = myPart?.self_reported_at !== null && myPart?.self_reported_at !== undefined;
            return (
              <Animated.View
                entering={FadeInDown.delay(127).springify()}
                style={styles.section}
              >
                <Card
                  variant="subtle"
                  onPress={() =>
                    router.push(`/(app)/matches/${match.id}/self-report`)
                  }
                >
                  <View style={styles.selfReportRow}>
                    <View style={styles.selfReportIcon}>
                      <Ionicons name="football-outline" size={20} color={colors.goldDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selfReportTitle}>
                        {reported ? 'Já reportaste' : 'Marcaste algum golo?'}
                      </Text>
                      <Text style={styles.selfReportBody}>
                        {reported
                          ? `${myPart?.self_reported_goals ?? 0} golos · ${myPart?.self_reported_assists ?? 0} assistências — podes atualizar`
                          : 'Reporta golos e assistências para o capitão validar.'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                  </View>
                </Card>
              </Animated.View>
            );
          })()}

        {match.is_internal && (() => {
          const myPart = participants.find((p) => p.user_id === session?.user.id);
          const accepted = participants.filter((p) => p.invitation_status === 'accepted').length;
          const declined = participants.filter((p) => p.invitation_status === 'declined').length;
          const pending = participants.filter((p) => p.invitation_status === 'pending').length;
          const canRespond =
            myPart &&
            match.status !== 'validated' &&
            match.status !== 'cancelled';
          return (
            <Animated.View
              entering={FadeInDown.delay(125).springify()}
              style={styles.section}
            >
              <Card variant="subtle">
                <Text style={styles.confirmTitle}>Convocatória</Text>
                <View style={styles.confirmRow}>
                  <View style={styles.confirmCell}>
                    <Text style={[styles.confirmValue, { color: '#34d399' }]}>
                      {accepted}
                    </Text>
                    <Text style={styles.confirmLabel}>Vão</Text>
                  </View>
                  <View style={styles.confirmCell}>
                    <Text style={[styles.confirmValue, { color: '#f87171' }]}>
                      {declined}
                    </Text>
                    <Text style={styles.confirmLabel}>Não vão</Text>
                  </View>
                  <View style={styles.confirmCell}>
                    <Text style={styles.confirmValue}>{pending}</Text>
                    <Text style={styles.confirmLabel}>Pendentes</Text>
                  </View>
                </View>

                {canRespond && (
                  <View style={styles.confirmActions}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={myPart!.invitation_status === 'accepted' ? '✓ Vou' : 'Vou'}
                        variant={
                          myPart!.invitation_status === 'accepted' ? 'primary' : 'secondary'
                        }
                        size="sm"
                        haptic="light"
                        loading={respondBusy}
                        onPress={async () => {
                          setRespondBusy(true);
                          const r = await respondToMatchInvite(match.id, true);
                          setRespondBusy(false);
                          if (!r.ok) {
                            Alert.alert('Erro', r.message);
                            return;
                          }
                          await load();
                        }}
                        full
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label={myPart!.invitation_status === 'declined' ? '✗ Não vou' : 'Não vou'}
                        variant={
                          myPart!.invitation_status === 'declined' ? 'danger' : 'ghost'
                        }
                        size="sm"
                        loading={respondBusy}
                        onPress={async () => {
                          setRespondBusy(true);
                          const r = await respondToMatchInvite(match.id, false);
                          setRespondBusy(false);
                          if (!r.ok) {
                            Alert.alert('Erro', r.message);
                            return;
                          }
                          await load();
                        }}
                        full
                      />
                    </View>
                  </View>
                )}

                {isCaptain &&
                  match.status !== 'validated' &&
                  match.status !== 'cancelled' && (
                    <View style={{ marginTop: 12 }}>
                      <Button
                        label="🎲 Sortear lados"
                        variant="secondary"
                        size="sm"
                        onPress={() =>
                          router.push(`/(app)/matches/${match.id}/draw`)
                        }
                        full
                      />
                    </View>
                  )}
              </Card>

              {isCaptain && match.status !== 'cancelled' && (
                <Card variant="subtle" style={{ marginTop: 12 }}>
                  {(() => {
                    const goingOrPending = participants.filter(
                      (p) => p.invitation_status !== 'declined',
                    );
                    const paid = goingOrPending.filter((p) => p.has_paid).length;
                    return (
                      <>
                        <View style={styles.confirmRow}>
                          <Text style={styles.confirmTitle}>
                            💸 Pagamentos
                          </Text>
                          <Text style={styles.payCount}>
                            {`${paid}/${goingOrPending.length}`}
                          </Text>
                        </View>
                        <Text style={styles.payHint}>
                          Pagamento fora da app. Toca para marcar quem já pagou.
                        </Text>
                        <View style={{ marginTop: 10, gap: 6 }}>
                          {goingOrPending.length === 0 ? (
                            <Text style={styles.payHint}>
                              Ainda ninguém confirmou.
                            </Text>
                          ) : (
                            goingOrPending.map((p) => (
                              <Pressable
                                key={p.user_id}
                                style={[
                                  styles.payRow,
                                  p.has_paid && styles.payRowOn,
                                ]}
                                onPress={async () => {
                                  const r = await markParticipantPaid(
                                    match.id,
                                    p.user_id,
                                    !p.has_paid,
                                  );
                                  if (!r.ok) {
                                    Alert.alert('Erro', r.message);
                                    return;
                                  }
                                  await load();
                                }}
                              >
                                <Text style={styles.payName} numberOfLines={1}>
                                  {p.profile?.name ?? 'Jogador'}
                                </Text>
                                <Text
                                  style={[
                                    styles.payStatus,
                                    p.has_paid && styles.payStatusOn,
                                  ]}
                                >
                                  {p.has_paid ? '✓ Pago' : 'Por pagar'}
                                </Text>
                              </Pressable>
                            ))
                          )}
                        </View>
                      </>
                    );
                  })()}
                </Card>
              )}
            </Animated.View>
          );
        })()}

        {match.status === 'confirmed' &&
          new Date(match.scheduled_at).getTime() > Date.now() &&
          isCaptain &&
          (() => {
            const declined = participants.filter(
              (p) => p.invitation_status === 'declined',
            ).length;
            if (declined === 0) return null;
            return (
              <Animated.View
                entering={FadeInDown.delay(135).springify()}
                style={{ marginTop: 16 }}
              >
                <Card
                  variant="warning"
                  onPress={() =>
                    router.push(`/(app)/matches/${match.id}/substitutes`)
                  }
                >
                  <View style={styles.subAlertRow}>
                    <Text style={styles.subAlertIcon}>🆘</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subAlertTitle}>
                        {`${declined} ${declined === 1 ? 'jogador não vai' : 'jogadores não vão'}`}
                      </Text>
                      <Text style={styles.subAlertBody}>
                        Toca para procurar substituto agora.
                      </Text>
                    </View>
                    <Text style={styles.subAlertArrow}>›</Text>
                  </View>
                </Card>
              </Animated.View>
            );
          })()}

        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.actions}>
          {isParticipant && match.status !== 'cancelled' && (
            <Button
              label={
                chatUnread > 0
                  ? `💬 Chat do jogo · ${chatUnread > 9 ? '9+' : chatUnread} por ler`
                  : '💬 Chat do jogo'
              }
              variant="secondary"
              full
              onPress={() => router.push(`/(app)/matches/${match.id}/chat`)}
            />
          )}

          {canAccept && (
            <Button
              label="Aceitar desafio"
              size="lg"
              haptic="medium"
              loading={acting}
              onPress={handleAccept}
              full
            />
          )}

          {canReject && (
            <Button
              label={isCaptainB ? 'Recusar' : 'Cancelar proposta'}
              variant="secondary"
              onPress={handleReject}
              loading={acting}
              full
            />
          )}

          {match.status === 'confirmed' && (
            <ActionRow
              icon="calendar-outline"
              label="Adicionar ao calendário"
              onPress={async () => {
                const r = await addMatchToCalendar({
                  title: `${match.side_a.name} vs ${match.side_b.name}`,
                  scheduled_at: match.scheduled_at,
                  location: match.location_tbd
                    ? 'A combinar'
                    : (match.location_name ?? undefined),
                });
                if (!r.ok) Alert.alert('Calendário', r.message);
                else Alert.alert('Calendário', 'Jogo adicionado ao calendário.');
              }}
            />
          )}

          {match.status === 'confirmed' && isCaptain && (
            <>
              <ActionRow
                icon="person-add-outline"
                label="Convidar substituto"
                onPress={() =>
                  router.push(`/(app)/matches/${match.id}/substitutes`)
                }
              />
              <ActionRow
                icon="megaphone-outline"
                label="Pedido aberto de substituto"
                onPress={() =>
                  router.push(`/(app)/matches/${match.id}/substitute-request`)
                }
              />
            </>
          )}

          {(match.status === 'confirmed' || match.status === 'proposed') &&
            isCaptain && (
              <ActionRow
                icon="time-outline"
                label="Remarcar"
                onPress={() =>
                  router.push(`/(app)/matches/${match.id}/reschedule`)
                }
              />
            )}

          {match.status === 'confirmed' && isCaptain && (
            <Button
              label="Cancelar jogo"
              variant="ghost"
              full
              onPress={() =>
                router.push(`/(app)/matches/${match.id}/cancel`)
              }
            />
          )}

          {canSubmitResult && (
            <Button
              label="Submeter resultado"
              size="lg"
              haptic="medium"
              full
              onPress={() => router.push(`/(app)/matches/${match.id}/result`)}
            />
          )}

          {canReview && (
            <Pressable
              onPress={() => router.push(`/(app)/matches/${match.id}/post`)}
              style={styles.postBanner}
            >
              <View style={styles.postBannerIcon}>
                <Text style={styles.postBannerIconText}>⭐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.postBannerTitle}>Pós-jogo</Text>
                <Text style={styles.postBannerBody}>
                  Vota no MVP, avalia a equipa adversária (capitão) e ajusta os atributos dos amigos.
                </Text>
              </View>
              <Text style={styles.postBannerArrow}>›</Text>
            </Pressable>
          )}

          {match.status === 'validated' &&
            match.final_score_a !== null &&
            match.final_score_b !== null && (
              <Button
                label="↗ Partilhar resultado"
                variant="secondary"
                full
                onPress={async () => {
                  const result = `${match.side_a.name} ${match.final_score_a}–${match.final_score_b} ${match.side_b.name}\n${formatMatchDate(match.scheduled_at)}\n\nJogado na S7VN 🟢`;
                  try {
                    await Share.share({ message: result });
                  } catch {
                    // user cancelled
                  }
                }}
              />
            )}
        </Animated.View>

        {match.status === 'validated' && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <MatchPhotoStrip matchId={match.id} canUpload={isParticipant} />
          </Animated.View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SidePillar({
  name,
  photoUrl,
  score,
  winner,
  onPress,
}: {
  name: string;
  photoUrl: string | null;
  score: number | null;
  winner: boolean;
  onPress: () => void;
}) {
  const hasScore = score !== null && score !== undefined;
  const dim = hasScore && !winner;
  return (
    <Pressable onPress={onPress} style={styles.sidePillar}>
      <Avatar url={photoUrl} name={name} size={56} />
      <Text
        style={[styles.sidePillarName, dim && styles.sidePillarDim]}
        numberOfLines={2}
      >
        {name}
      </Text>
      <Text style={[styles.sidePillarScore, dim && styles.sidePillarScoreDim]}>
        {hasScore ? String(score) : '—'}
      </Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: MatchSummary['status'] }) {
  const bg =
    status === 'confirmed' || status === 'validated'
      ? 'rgba(52,211,153,0.12)'
      : status === 'cancelled' || status === 'disputed'
        ? 'rgba(248,113,113,0.12)'
        : 'rgba(251,191,36,0.12)';
  const fg =
    status === 'confirmed' || status === 'validated'
      ? '#34d399'
      : status === 'cancelled' || status === 'disputed'
        ? '#f87171'
        : '#fbbf24';
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
        {statusLabel(status).toUpperCase()}
      </Text>
    </View>
  );
}

function PlantelColumn({
  title,
  players,
  meId,
  onPress,
  onReport,
}: {
  title: string;
  players: MatchParticipant[];
  meId: string | null;
  onPress: (userId: string) => void;
  onReport: (userId: string, name: string) => void;
}) {
  return (
    <View style={styles.plantelCol}>
      <Text style={styles.plantelColTitle} numberOfLines={1}>
        {title}
      </Text>
      {players.length === 0 ? (
        <Text style={styles.plantelEmpty}>—</Text>
      ) : (
        players.map((p) => {
          const name = p.profile?.name ?? 'Jogador';
          const isSelf = meId === p.user_id;
          return (
            <Pressable
              key={p.user_id}
              onPress={() => onPress(p.user_id)}
              onLongPress={isSelf ? undefined : () => onReport(p.user_id, name)}
              delayLongPress={350}
              style={styles.plantelRow}
            >
              <Avatar
                url={p.profile?.photo_url ?? null}
                name={name}
                size={28}
              />
              <Text style={styles.plantelName} numberOfLines={1}>
                {name.split(' ')[0]}
              </Text>
              {(p.goals > 0 || p.assists > 0) && (
                <View style={styles.plantelStats}>
                  {p.goals > 0 && (
                    <View style={styles.plantelStatBadge}>
                      <Ionicons name="football" size={9} color={colors.warning} />
                      <Text style={styles.plantelStatText}>{p.goals}</Text>
                    </View>
                  )}
                  {p.assists > 0 && (
                    <View style={styles.plantelStatBadge}>
                      <Ionicons name="hand-right" size={9} color={colors.success} />
                      <Text style={styles.plantelStatText}>{p.assists}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function openReportSheet(
  router: ReturnType<typeof useRouter>,
  matchId: string,
  userId: string,
  name: string,
) {
  Alert.alert(
    name,
    'Reportar este jogador no contexto deste jogo? A denúncia é anónima e revista pela equipa S7VN.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ver perfil', onPress: () => router.push(`/(app)/users/${userId}`) },
      {
        text: 'Reportar',
        style: 'destructive',
        onPress: () =>
          router.push({
            pathname: '/(app)/users/[id]/report',
            params: { id: userId, name, matchId },
          }),
      },
    ],
  );
}

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  scoreSplit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 4,
  },
  scoreSeparator: {
    color: 'rgba(255,255,255,0.18)',
    fontSize: 36,
    fontWeight: '900',
    alignSelf: 'center',
    marginTop: 60,
  },
  sidePillar: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  sidePillarName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginTop: 2,
    minHeight: 32,
  },
  sidePillarDim: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '700',
  },
  sidePillarScore: {
    color: '#ffffff',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 56,
    marginTop: 4,
  },
  sidePillarScoreDim: {
    color: 'rgba(255,255,255,0.4)',
  },
  internalBanner: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(201,162,107,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,107,0.3)',
    marginBottom: 12,
  },
  internalBannerText: {
    color: '#C9A26B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refWhistle: { fontSize: 22 },
  refLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  refName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  refEdit: {
    color: '#C9A26B',
    fontSize: 12,
    fontWeight: '700',
  },
  refAddBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
  },
  refAddText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  confirmTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  confirmRow: { flexDirection: 'row' },
  confirmCell: { flex: 1, alignItems: 'center' },
  confirmValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  confirmLabel: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  payCount: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginLeft: 'auto',
  },
  payHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  payRowOn: {
    borderColor: 'rgba(52,211,153,0.4)',
    backgroundColor: 'rgba(52,211,153,0.10)',
  },
  payName: { color: '#ffffff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  payStatus: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  payStatusOn: { color: '#34d399' },
  subAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subAlertIcon: { fontSize: 22 },
  subAlertTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subAlertBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  subAlertArrow: { color: colors.textDim, fontSize: 22 },
  postBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201,162,107,0.35)',
    backgroundColor: 'rgba(201,162,107,0.08)',
  },
  postBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(201,162,107,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBannerIconText: { fontSize: 20 },
  postBannerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  postBannerBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  postBannerArrow: { color: colors.textDim, fontSize: 22 },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#f87171',
    marginBottom: 8,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  liveText: {
    color: '#0E1812',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  plantelHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 4,
  },
  selfReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selfReportIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  selfReportTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  selfReportBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  plantelGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  plantelCol: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  plantelColTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  plantelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plantelName: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  plantelStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  plantelStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  plantelStatText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  plantelEmpty: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCell: { flex: 1, alignItems: 'center' },
  previewPct: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  previewRecord: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  previewSep: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  recapLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  recapRow: { flexDirection: 'row', gap: 8 },
  recapCell: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  recapCellLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  recapCellName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.2,
  },
  recapCellMeta: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  section: { marginTop: 16 },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notesLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  notesEdit: {
    color: '#C9A26B',
    fontSize: 12,
    fontWeight: '700',
  },
  notesBody: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  notesEmpty: {
    color: colors.textDim,
    fontSize: 13,
    fontStyle: 'italic',
  },
  h2hLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  h2hRow: { flexDirection: 'row' },
  h2hCell: { flex: 1, alignItems: 'center' },
  h2hValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  h2hDraws: { color: colors.textMuted },
  h2hMeta: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  h2hFoot: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  infoLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  infoValue: { color: '#ffffff', fontSize: 15, letterSpacing: -0.2 },
  actions: { marginTop: 24, gap: 8 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  actionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
});
