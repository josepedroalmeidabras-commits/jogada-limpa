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
  statusLabel,
  type MatchSummary,
} from '@/lib/matches';
import { addMatchToCalendar } from '@/lib/calendar';
import { fetchMatchUnreadCount } from '@/lib/match-chat';
import { fetchHeadToHead, type HeadToHead } from '@/lib/h2h';
import { fetchReferee, type RefereeProfile } from '@/lib/referee';
import { Avatar } from '@/components/Avatar';
import {
  fetchMatchParticipants,
  type MatchParticipant,
} from '@/lib/result';
import { respondToMatchInvite } from '@/lib/internal-match';
import { Screen } from '@/components/Screen';
import { Heading } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { MatchPhotoStrip } from '@/components/MatchPhotoStrip';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [h2h, setH2h] = useState<HeadToHead | null>(null);
  const [referee, setReferee] = useState<RefereeProfile | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [respondBusy, setRespondBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const m = await fetchMatchById(id);
    setMatch(m);
    if (m && session) {
      const [part, unread, hh, ref, parts] = await Promise.all([
        isMatchParticipant(m.id, session.user.id),
        fetchMatchUnreadCount(m.id, session.user.id),
        fetchHeadToHead(m.side_a.id, m.side_b.id),
        m.referee_id ? fetchReferee(m.referee_id) : Promise.resolve(null),
        m.is_internal
          ? fetchMatchParticipants(m.id)
          : Promise.resolve<MatchParticipant[]>([]),
      ]);
      setIsParticipant(part);
      setChatUnread(unread);
      setH2h(hh);
      setReferee(ref);
      setParticipants(parts);
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
          <Text style={{ color: '#a3a3a3' }}>Jogo não encontrado.</Text>
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
  const canReview = match.status === 'validated';

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Jogo',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <Card variant="subtle">
            {match.is_internal && (
              <View style={styles.internalBanner}>
                <Text style={styles.internalBannerText}>
                  ⚡ Peladinha · {match.side_a.name}
                </Text>
              </View>
            )}
            <View style={styles.scoreboard}>
              <Side
                name={match.is_internal && match.side_a_label
                  ? match.side_a_label
                  : match.side_a.name}
                score={match.final_score_a}
                onPress={() => router.push(`/(app)/teams/${match.side_a.id}`)}
              />
              <Text style={styles.vs}>vs</Text>
              <Side
                name={match.is_internal && match.side_b_label
                  ? match.side_b_label
                  : match.side_b.name}
                score={match.final_score_b}
                onPress={() => router.push(`/(app)/teams/${match.side_b.id}`)}
              />
            </View>
            <View style={{ alignItems: 'center', marginTop: 14 }}>
              <StatusBadge status={match.status} />
            </View>
          </Card>
        </Animated.View>

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
              <Text style={styles.h2hLabel}>📊 Head-to-head</Text>
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
                        label="Distribuir lados"
                        variant="secondary"
                        size="sm"
                        onPress={() =>
                          router.push(`/(app)/matches/${match.id}/split`)
                        }
                        full
                      />
                    </View>
                  )}
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
            <Button
              label="📅 Adicionar ao calendário"
              variant="secondary"
              full
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
            <Button
              label="Procurar substituto"
              variant="secondary"
              full
              onPress={() =>
                router.push(`/(app)/matches/${match.id}/substitutes`)
              }
            />
          )}

          {(match.status === 'confirmed' || match.status === 'proposed') &&
            isCaptain && (
              <Button
                label="📅 Remarcar"
                variant="secondary"
                full
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
            <Button
              label="Avaliar jogadores"
              size="lg"
              haptic="medium"
              full
              onPress={() => router.push(`/(app)/matches/${match.id}/review`)}
            />
          )}

          {canReview && (
            <Button
              label="👑 Votar MVP"
              variant="secondary"
              full
              onPress={() => router.push(`/(app)/matches/${match.id}/mvp`)}
            />
          )}

          {canReview && isParticipant && (
            <Button
              label="🪞 Auto-avaliar"
              variant="secondary"
              full
              onPress={() => router.push(`/(app)/matches/${match.id}/self-rating`)}
            />
          )}

          {canReview &&
            isParticipant &&
            referee &&
            referee.id !== session?.user.id && (
              <Button
                label="🥏 Avaliar árbitro"
                variant="secondary"
                full
                onPress={() =>
                  router.push(`/(app)/matches/${match.id}/referee-review`)
                }
              />
            )}

          {match.status === 'validated' &&
            match.final_score_a !== null &&
            match.final_score_b !== null && (
              <Button
                label="↗ Partilhar resultado"
                variant="secondary"
                full
                onPress={async () => {
                  const result = `${match.side_a.name} ${match.final_score_a}–${match.final_score_b} ${match.side_b.name}\n${formatMatchDate(match.scheduled_at)}\n\nJogado na Jogada Limpa 🟢`;
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

function Side({
  name,
  score,
  onPress,
}: {
  name: string;
  score: number | null;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} variant="subtle" style={styles.sideBox}>
      <Text style={styles.sideName} numberOfLines={2}>
        {name}
      </Text>
      {score !== null && score !== undefined && (
        <Text style={styles.sideScore}>{score}</Text>
      )}
    </Card>
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

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  scoreboard: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sideBox: { flex: 1, alignItems: 'center', minHeight: 100, justifyContent: 'center' },
  sideName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sideScore: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 4,
  },
  vs: {
    color: '#5a5a5a',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  internalBanner: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    marginBottom: 12,
  },
  internalBannerText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refWhistle: { fontSize: 22 },
  refLabel: {
    color: '#737373',
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
    color: '#22c55e',
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
    color: '#a3a3a3',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmTitle: {
    color: '#a3a3a3',
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
    color: '#737373',
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
  section: { marginTop: 16 },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notesLabel: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  notesEdit: {
    color: '#22c55e',
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
    color: '#737373',
    fontSize: 13,
    fontStyle: 'italic',
  },
  h2hLabel: {
    color: '#a3a3a3',
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
  h2hDraws: { color: '#a3a3a3' },
  h2hMeta: {
    color: '#737373',
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  h2hFoot: {
    color: '#737373',
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
    color: '#737373',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  infoValue: { color: '#ffffff', fontSize: 15, letterSpacing: -0.2 },
  actions: { marginTop: 24, gap: 8 },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
});
