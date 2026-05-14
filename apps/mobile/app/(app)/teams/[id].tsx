import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchCoach,
  fetchTeamById,
  fetchTeamMembers,
  fetchTeamRecentForm,
  fetchTeamStats,
  fetchTeamTopContributors,
  isTeamLeader,
  leaveTeam,
  positionShort,
  type CoachProfile,
  type TeamContributor,
  type TeamFormResult,
  type TeamMember,
  type TeamStatRow,
  type TeamWithSport,
} from '@/lib/teams';
import { fetchFriends, type FriendProfile } from '@/lib/friends';
import {
  computeTeamRecord,
  fetchMatchesForTeam,
  formatRelativeMatchDate,
  type MatchSummary,
  type TeamRecord,
} from '@/lib/matches';
import {
  fetchSuggestedOpponents,
  type SuggestedOpponent,
} from '@/lib/h2h';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import {
  MatchListItem,
  MatchListGroup,
} from '@/components/MatchListItem';
import { FormStrip, type FormResult } from '@/components/FormStrip';
import { TeamHeroCard } from '@/components/TeamHeroCard';
import { StarRating } from '@/components/StarRating';
import { OUTFIELD_CATEGORIES, type StatCategory } from '@/lib/player-stats';
import {
  fetchTeamFaceoffLeaderboard,
  type FaceoffLeaderboardEntry,
} from '@/lib/faceoff';
import {
  fetchTeamReviewAggregate,
  type TeamReviewAggregate,
} from '@/lib/reviews';
import { recentTeams } from '@/lib/recent';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [suggested, setSuggested] = useState<SuggestedOpponent[]>([]);
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [contributors, setContributors] = useState<TeamContributor[]>([]);
  const [friendMembers, setFriendMembers] = useState<FriendProfile[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStatRow[]>([]);
  const [teamForm, setTeamForm] = useState<TeamFormResult[]>([]);
  const [faceoffBoard, setFaceoffBoard] = useState<FaceoffLeaderboardEntry[]>([]);
  const [reputation, setReputation] = useState<TeamReviewAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [t, m, ms, contribs, friends, ts, tf, fb, rep] = await Promise.all([
      fetchTeamById(id),
      fetchTeamMembers(id),
      fetchMatchesForTeam(id),
      fetchTeamTopContributors(id, 10),
      fetchFriends(),
      fetchTeamStats(id),
      fetchTeamRecentForm(id, 5),
      fetchTeamFaceoffLeaderboard(id, 5),
      fetchTeamReviewAggregate(id),
    ]);
    setFaceoffBoard(fb);
    setReputation(rep);
    setTeam(t);
    setMembers(m);
    setMatches(ms);
    setContributors(contribs);
    setTeamStats(ts);
    setTeamForm(tf);
    const memberIds = new Set(m.map((mm) => mm.user_id));
    setFriendMembers(friends.filter((f) => memberIds.has(f.id)));
    if (t?.coach_id) {
      const c = await fetchCoach(t.coach_id);
      setCoach(c);
    } else {
      setCoach(null);
    }
    if (t && session && t.captain_id === session.user.id) {
      const sug = await fetchSuggestedOpponents(t.id, 5);
      setSuggested(sug);
    }
    if (t) {
      void recentTeams.add({
        id: t.id,
        name: t.name,
        photo_url: t.photo_url,
        meta: `${t.sport?.name ?? 'S7VN'} · ${t.city}`,
      });
    }
    setLoading(false);
  }, [id, session]);

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

  if (loading) {
    return (
      <Screen>
        <View style={{ padding: 24, gap: 12 }}>
          <Skeleton width={64} height={64} radius={32} />
          <Skeleton width={200} height={28} />
          <Skeleton height={70} radius={16} style={{ marginTop: 12 }} />
          <Skeleton height={70} radius={16} />
        </View>
      </Screen>
    );
  }

  if (!team) {
    return (
      <Screen>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <Text style={{ color: colors.textMuted }}>Equipa não encontrada.</Text>
          <Button
            label="Voltar"
            variant="secondary"
            onPress={() => router.replace('/(app)')}
          />
        </View>
      </Screen>
    );
  }

  const isCaptain = team.captain_id === session?.user.id;
  const isLeader = isTeamLeader(team, session?.user.id);
  const inviteMessage =
    `Junta-te à minha equipa "${team.name}" na S7VN ⚽\n\n` +
    `Código de entrada: ${team.invite_code.toUpperCase()}\n\n` +
    `Descarrega a app em jogadalimpa.app e insere o código.`;

  async function copyCode() {
    await Clipboard.setStringAsync(team!.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function shareInvite() {
    try {
      await Share.share({ message: inviteMessage });
    } catch (e) {
      console.error('share error', e);
    }
  }

  const record = computeTeamRecord(matches, team.id);
  const nowMs = Date.now();
  const nextTeamMatch = matches
    .filter(
      (m) =>
        m.status === 'confirmed' &&
        new Date(m.scheduled_at).getTime() > nowMs,
    )
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() -
        new Date(b.scheduled_at).getTime(),
    )[0];

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: team.name,
          headerStyle: { backgroundColor: '#0E1812' },
          headerTintColor: '#ffffff',
        }}
      />
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
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={styles.header}
        >
          <Avatar url={team.photo_url} name={team.name} size={72} />
          <View style={{ flex: 1 }}>
            <Heading level={2}>{team.name}</Heading>
            <Text style={styles.meta}>
              {`${team.sport?.name ?? 'S7VN'} · ${team.city}${
                isCaptain
                  ? ' · capitão'
                  : isLeader
                    ? ' · sub-capitão'
                    : ''
              }`}
            </Text>
            {!isCaptain && (() => {
              const captain = members.find((m) => m.role === 'captain');
              if (!captain) return null;
              return (
                <Text style={styles.meta2} numberOfLines={1}>
                  {`Capitão · ${captain.profile?.name ?? 'Sem nome'}`}
                </Text>
              );
            })()}
          </View>
          {members.some((m) => m.user_id === session?.user.id) && (
            <Pressable
              onPress={() => router.push(`/(app)/teams/${team.id}/chat`)}
              style={styles.chatBtn}
            >
              <Ionicons
                name="chatbubble-ellipses"
                size={20}
                color={colors.brand}
              />
            </Pressable>
          )}
        </Animated.View>

        {team.announcement && (
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <Card variant="warning" style={{ marginTop: 16 }}>
              <View style={styles.annHeader}>
                <Text style={styles.annLabel}>📌 Aviso fixado</Text>
                {team.announcement_at && (
                  <Text style={styles.annDate}>
                    {new Date(team.announcement_at).toLocaleDateString('pt-PT', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </Text>
                )}
              </View>
              <Text style={styles.annBody}>{team.announcement}</Text>
            </Card>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(55).springify()}
          style={{ marginTop: 16 }}
        >
          {(() => {
            const topGoal = contributors.find((c) => c.goals > 0);
            const topAssist = [...contributors]
              .sort((a, b) => b.assists - a.assists)
              .find((c) => c.assists > 0);
            return (
              <TeamHeroCard
                name={team.name}
                city={team.city}
                photoUrl={team.photo_url}
                memberCount={members.length}
                winPct={
                  record.played > 0
                    ? Math.round((record.wins / record.played) * 100)
                    : null
                }
                wins={record.wins}
                draws={record.draws}
                losses={record.losses}
                goalsFor={record.goals_for}
                goalsAgainst={record.goals_against}
                form={teamForm.map((f) => f.outcome as FormResult)}
                topScorer={
                  topGoal
                    ? {
                        user_id: topGoal.user_id,
                        name: topGoal.name,
                        photo_url: topGoal.photo_url,
                        value: topGoal.goals,
                      }
                    : null
                }
                topAssist={
                  topAssist
                    ? {
                        user_id: topAssist.user_id,
                        name: topAssist.name,
                        photo_url: topAssist.photo_url,
                        value: topAssist.assists,
                      }
                    : null
                }
                onScorerPress={
                  topGoal
                    ? () => router.push(`/(app)/users/${topGoal.user_id}`)
                    : undefined
                }
                onAssistPress={
                  topAssist
                    ? () => router.push(`/(app)/users/${topAssist.user_id}`)
                    : undefined
                }
              />
            );
          })()}
        </Animated.View>

        {reputation && reputation.total_reviews > 0 && (
          <Animated.View
            entering={FadeInDown.delay(57).springify()}
            style={{ marginTop: 12 }}
          >
            <Eyebrow>Reputação</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              <View style={styles.repStarsHero}>
                <StarRating value={reputation.avg_overall ?? 0} size={28} />
                <Text style={styles.repStarsValue}>
                  {(reputation.avg_overall ?? 0).toFixed(1)}
                </Text>
              </View>
              <Text style={styles.repFoot}>
                {`${reputation.total_reviews} avaliaç${reputation.total_reviews === 1 ? 'ão' : 'ões'} de adversários`}
              </Text>
            </Card>
          </Animated.View>
        )}

        {team.description && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Card style={{ marginTop: 16 }}>
              <Text style={styles.description}>{team.description}</Text>
            </Card>
          </Animated.View>
        )}

        {coach && (
          <Animated.View entering={FadeInDown.delay(70).springify()}>
            <Card
              onPress={() => router.push(`/(app)/users/${coach.id}`)}
              style={{ marginTop: 12 }}
            >
              <View style={styles.coachRow}>
                <Text style={styles.coachIcon}>📋</Text>
                <Avatar url={coach.photo_url} name={coach.name} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.coachLabel}>Treinador</Text>
                  <Text style={styles.coachName}>{coach.name}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </View>
            </Card>
          </Animated.View>
        )}

        {friendMembers.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(70).springify()}
            style={styles.friendsPillRow}
          >
            <View style={styles.friendsAvatars}>
              {friendMembers.slice(0, 4).map((f, i) => (
                <View
                  key={f.id}
                  style={[
                    styles.friendsAvatarWrap,
                    { marginLeft: i === 0 ? 0 : -10 },
                  ]}
                >
                  <Avatar url={f.photo_url} name={f.name} size={24} />
                </View>
              ))}
            </View>
            <Text style={styles.friendsPillText}>
              {friendMembers.length === 1
                ? `1 amigo no plantel: ${friendMembers[0]!.name.split(' ')[0]}`
                : friendMembers.length <= 3
                  ? `${friendMembers.length} amigos no plantel: ${friendMembers
                      .map((f) => f.name.split(' ')[0])
                      .join(', ')}`
                  : `${friendMembers[0]!.name.split(' ')[0]}, ${friendMembers[1]!.name.split(' ')[0]} e mais ${friendMembers.length - 2}`}
            </Text>
          </Animated.View>
        )}

        {nextTeamMatch && (
          <Animated.View
            entering={FadeInDown.delay(75).springify()}
            style={{ marginTop: 16 }}
          >
            <Card
              onPress={() =>
                router.push(`/(app)/matches/${nextTeamMatch.id}`)
              }
              variant="subtle"
            >
              <Text style={styles.nextLabel}>📅 Próximo jogo</Text>
              <Text style={styles.nextTeams} numberOfLines={1}>
                {nextTeamMatch.is_internal && nextTeamMatch.side_a_label
                  ? `${nextTeamMatch.side_a_label} vs ${nextTeamMatch.side_b_label}`
                  : `${nextTeamMatch.side_a.name} vs ${nextTeamMatch.side_b.name}`}
              </Text>
              <Text style={styles.nextWhen}>
                {formatRelativeMatchDate(nextTeamMatch.scheduled_at)}
              </Text>
              <Text style={styles.nextWhere} numberOfLines={1}>
                {`📍 ${nextTeamMatch.location_tbd ? 'A combinar' : (nextTeamMatch.location_name ?? '—')}`}
              </Text>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(80).springify()}>
          <TeamRecordRow record={record} />
        </Animated.View>

        {(() => {
          const lastFive: FormResult[] = matches
            .filter(
              (m) =>
                m.status === 'validated' &&
                m.final_score_a !== null &&
                m.final_score_b !== null,
            )
            .slice(0, 5)
            .map((m) => {
              const isA = m.side_a.id === team.id;
              const myScore = isA ? m.final_score_a! : m.final_score_b!;
              const oppScore = isA ? m.final_score_b! : m.final_score_a!;
              if (myScore > oppScore) return 'win' as const;
              if (myScore < oppScore) return 'loss' as const;
              return 'draw' as const;
            })
            .reverse();
          if (lastFive.length === 0) return null;
          return (
            <Animated.View
              entering={FadeInDown.delay(100).springify()}
              style={{ marginTop: 12, alignItems: 'center' }}
            >
              <FormStrip results={lastFive} size="md" />
            </Animated.View>
          );
        })()}

        {isLeader && (
          <Animated.View
            entering={FadeInDown.delay(140).springify()}
            style={styles.actions}
          >
            <Button
              label="Marcar jogo"
              size="lg"
              haptic="medium"
              onPress={() =>
                router.push(`/(app)/teams/${team.id}/match/new`)
              }
              full
            />
            <Button
              label="Peladinha interna"
              variant="secondary"
              onPress={() =>
                router.push(`/(app)/teams/${team.id}/internal/new`)
              }
              full
            />
            <Button
              label="🔔 Publicar desafio aberto"
              variant="secondary"
              onPress={() =>
                router.push(`/(app)/teams/${team.id}/open-request`)
              }
              full
            />
            {isCaptain && (
              <Button
                label="Editar equipa"
                variant="ghost"
                onPress={() => router.push(`/(app)/teams/${team.id}/edit`)}
                full
              />
            )}
          </Animated.View>
        )}

        {!isCaptain && session && (
          <Animated.View
            entering={FadeInDown.delay(140).springify()}
            style={{ marginTop: 16 }}
          >
            <Button
              label="Sair da equipa"
              variant="secondary"
              full
              onPress={() =>
                Alert.alert(
                  'Sair da equipa?',
                  `Vais deixar de ser membro de ${team.name}. Podes voltar com o código de convite.`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Sair',
                      style: 'destructive',
                      onPress: async () => {
                        const r = await leaveTeam(team.id, session.user.id);
                        if (!r.ok) {
                          Alert.alert('Erro', r.message);
                          return;
                        }
                        router.replace('/(app)');
                      },
                    },
                  ],
                )
              }
            />
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(200).springify()}
          style={styles.section}
        >
          <Eyebrow>{`Jogos · ${matches.length}`}</Eyebrow>
          {matches.length === 0 ? (
            <Card style={{ marginTop: 8 }}>
              <Text style={styles.muted}>
                {`Sem jogos ainda.${isCaptain ? ' Toca em "Marcar jogo" para começar.' : ''}`}
              </Text>
            </Card>
          ) : (
            <Animated.View
              entering={FadeInDown.delay(240).springify()}
              style={{ marginTop: 8 }}
            >
              <MatchListGroup>
                {matches.map((m) => (
                  <MatchListItem
                    key={m.id}
                    match={m}
                    highlightTeamId={team.id}
                    onPress={() => router.push(`/(app)/matches/${m.id}`)}
                  />
                ))}
              </MatchListGroup>
            </Animated.View>
          )}
        </Animated.View>

        {isCaptain && suggested.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(260).springify()}
            style={styles.section}
          >
            <Eyebrow>Adversários do teu nível</Eyebrow>
            {suggested.map((s, i) => (
              <Animated.View
                key={s.team_id}
                entering={FadeInDown.delay(300 + i * 30).springify()}
              >
                <Card
                  onPress={() => router.push(`/(app)/teams/${s.team_id}`)}
                  style={{ marginTop: 8 }}
                >
                  <View style={styles.row}>
                    <Avatar
                      url={s.photo_url}
                      name={s.name}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{s.name}</Text>
                      <Text style={styles.itemMeta}>
                        {`Δ ELO ${Math.round(s.elo_diff)}${s.played_us > 0 ? ` · ${s.played_us} jogos` : ''}`}
                      </Text>
                    </View>
                    <Text style={styles.suggestedElo}>
                      {Math.round(s.elo_avg)}
                    </Text>
                  </View>
                </Card>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {faceoffBoard.length > 0 && faceoffBoard[0]!.total_votes > 0 && (
          <Animated.View
            entering={FadeInDown.delay(270).springify()}
            style={styles.section}
          >
            <Eyebrow>↔ Voto dos colegas</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              {faceoffBoard.slice(0, 5).map((row, i) => (
                <Pressable
                  key={row.user_id}
                  onPress={() => router.push(`/(app)/users/${row.user_id}`)}
                  style={[styles.boardRow, i > 0 && styles.boardRowBorder]}
                >
                  <Text style={styles.boardRank}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </Text>
                  <Avatar url={row.photo_url} name={row.name} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boardName} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text style={styles.boardMeta}>
                      {`${row.wins}V · ${row.losses}D${row.draws > 0 ? ` · ${row.draws}E` : ''}`}
                    </Text>
                  </View>
                  <Text style={styles.boardScore}>
                    {`${Math.round(row.win_score)}%`}
                  </Text>
                </Pressable>
              ))}
            </Card>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(280).springify()}
          style={styles.section}
        >
          <View style={styles.plantelHeader}>
            <Eyebrow>{`Plantel · ${members.length}`}</Eyebrow>
            {members.length >= 2 && (
              <Pressable
                onPress={() => {
                  // Step 1: pick player A
                  const candidates = members.slice(0, 8);
                  Alert.alert(
                    'Faceoff — escolhe o primeiro',
                    'Vais comparar dois jogadores e os colegas podem votar.',
                    [
                      ...candidates.map((m1) => ({
                        text: m1.profile?.name ?? 'Jogador',
                        onPress: () => {
                          const others = members.filter(
                            (mm) => mm.user_id !== m1.user_id,
                          ).slice(0, 8);
                          Alert.alert(
                            `Faceoff — ${m1.profile?.name ?? 'Jogador'} vs…`,
                            'Escolhe o segundo jogador',
                            [
                              ...others.map((m2) => ({
                                text: m2.profile?.name ?? 'Jogador',
                                onPress: () =>
                                  router.push(
                                    `/(app)/users/compare?a=${m1.user_id}&b=${m2.user_id}&team=${team.id}`,
                                  ),
                              })),
                              { text: 'Cancelar', style: 'cancel' as const },
                            ],
                          );
                        },
                      })),
                      { text: 'Cancelar', style: 'cancel' as const },
                    ],
                  );
                }}
              >
                <Text style={styles.plantelAction}>↔ Faceoff</Text>
              </Pressable>
            )}
          </View>
          {members.map((m, i) => (
            <Animated.View
              key={m.user_id}
              entering={FadeInDown.delay(320 + i * 30).springify()}
            >
              <Card
                onPress={() => router.push(`/(app)/users/${m.user_id}`)}
                style={{ marginTop: 8 }}
              >
                <View style={styles.row}>
                  <Avatar
                    url={m.profile?.photo_url}
                    name={m.profile?.name}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>
                      {m.preferred_position === 'gr' ? '🧤 ' : ''}
                      {m.profile?.name ?? 'Jogador'}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {m.role === 'captain'
                        ? 'Capitão'
                        : team.sub_captain_ids.includes(m.user_id)
                          ? 'Sub-capitão'
                          : 'Membro'}
                    </Text>
                  </View>
                  {m.preferred_position && (
                    <PositionChip position={m.preferred_position} />
                  )}
                  <Text style={styles.arrow}>›</Text>
                </View>
              </Card>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(360).springify()}
          style={styles.section}
        >
          <Eyebrow>Convidar jogadores</Eyebrow>
          <Card style={{ marginTop: 8 }}>
            <Text style={styles.inviteLabel}>Código</Text>
            <Text style={styles.inviteCode}>{team.invite_code}</Text>
            <View style={styles.inviteRow}>
              <View style={{ flex: 1 }}>
                <Button
                  label={copied ? '✓ Copiado' : 'Copiar'}
                  variant="secondary"
                  full
                  onPress={copyCode}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Partilhar" full onPress={shareInvite} />
              </View>
            </View>
            <Text style={styles.inviteHint}>
              Quem tiver o código pode entrar em "Entrar com código".
            </Text>
          </Card>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function PositionChip({ position }: { position: string }) {
  const short = positionShort(position);
  if (!short) return null;
  const bg =
    position === 'gr'
      ? 'rgba(251,191,36,0.14)'
      : position === 'def'
        ? 'rgba(56,189,248,0.14)'
        : position === 'med'
          ? 'rgba(201,162,107,0.14)'
          : position === 'ata'
            ? 'rgba(248,113,113,0.14)'
            : 'rgba(255,255,255,0.06)';
  const fg =
    position === 'gr'
      ? '#fbbf24'
      : position === 'def'
        ? '#38bdf8'
        : position === 'med'
          ? '#C9A26B'
          : position === 'ata'
            ? '#f87171'
            : colors.textMuted;
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: bg,
        marginRight: 6,
      }}
    >
      <Text style={{ color: fg, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
        {short}
      </Text>
    </View>
  );
}

function TeamRecordRow({ record }: { record: TeamRecord }) {
  if (record.played === 0) {
    return (
      <Card style={{ marginTop: 16 }}>
        <Text style={styles.muted}>Sem jogos validados ainda.</Text>
      </Card>
    );
  }
  const gd = record.goals_for - record.goals_against;
  return (
    <Card style={{ marginTop: 16 }}>
      <View style={styles.statsRow}>
        <Stat label="V" value={record.wins} color="#34d399" />
        <Stat label="E" value={record.draws} color="#fbbf24" />
        <Stat label="D" value={record.losses} color="#f87171" />
        <Stat label="DG" value={gd > 0 ? `+${gd}` : `${gd}`} color="#ffffff" />
        <Stat label="Jogos" value={record.played} color="#a3a3a3" />
      </View>
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ReputationCell({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.repCell}>
      <Text style={styles.repValue}>{value.toFixed(1)}</Text>
      <Text style={styles.repLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  meta2: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  repCell: { flex: 1, alignItems: 'center' },
  repValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  repLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  repDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  repFoot: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: 0.3,
  },
  repStarsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  repStarsValue: {
    color: colors.goldDeep,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  description: {
    color: '#d4d4d4',
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  nextLabel: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nextTeams: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 8,
  },
  nextWhen: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  nextWhere: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  friendsPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  friendsAvatars: { flexDirection: 'row', alignItems: 'center' },
  friendsAvatarWrap: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#0E1812',
  },
  friendsPillText: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
    letterSpacing: -0.1,
  },
  plantelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plantelAction: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  boardRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  boardRank: {
    width: 26,
    textAlign: 'center',
    fontSize: 18,
  },
  boardName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  boardMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  boardScore: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
    minWidth: 44,
    textAlign: 'right',
  },
  annHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  annLabel: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  annDate: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  annBody: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coachIcon: { fontSize: 22 },
  coachLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  coachName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  chatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { marginTop: 20, gap: 8 },
  section: { marginTop: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statsTopRow: { flexDirection: 'row' },
  statsCell: { flex: 1, alignItems: 'center' },
  statsValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  statsLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 14,
  },
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contribLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  contribName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  contribValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  suggestedElo: {
    color: colors.brand,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  itemMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  arrow: { color: colors.textFaint, fontSize: 22, fontWeight: '300' },
  muted: { color: colors.textDim, fontSize: 13 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  inviteLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  inviteCode: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 6,
    marginTop: 8,
    fontFamily: 'Menlo',
  },
  inviteRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  inviteHint: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 12,
    lineHeight: 18,
  },
});
