import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/auth';
import {
  fetchMatchById,
  type MatchSummary,
} from '@/lib/matches';
import { fetchMatchParticipants, type MatchParticipant } from '@/lib/result';
import { fetchMyReviewsForMatch, hasReviewedTeam } from '@/lib/reviews';
import { fetchMyMvpVote } from '@/lib/mvp';
import { fetchMySelfRating } from '@/lib/self-rating';
import { hasReviewedReferee } from '@/lib/referee';
import { fetchMyVotesFor, categoriesForPosition } from '@/lib/player-stats';
import { fetchPreferredPosition } from '@/lib/reviews';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

type PlayerSubTask = {
  user_id: string;
  name: string;
  photo_url: string | null;
  done: boolean;
};

export default function PostMatchHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [reviewsToDo, setReviewsToDo] = useState<PlayerSubTask[]>([]);
  const [statsToVote, setStatsToVote] = useState<PlayerSubTask[]>([]);
  const [mvpDone, setMvpDone] = useState(false);
  const [selfDone, setSelfDone] = useState(false);
  const [refereeDone, setRefereeDone] = useState<boolean | null>(null);
  const [opponentTeamDone, setOpponentTeamDone] = useState(false);
  const [opponentTeamName, setOpponentTeamName] = useState<string | null>(null);
  const [opponentTeamId, setOpponentTeamId] = useState<string | null>(null);
  const [opponentTeamLogo, setOpponentTeamLogo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id || !session) return;
    const [m, p] = await Promise.all([
      fetchMatchById(id),
      fetchMatchParticipants(id),
    ]);
    setMatch(m);
    setParticipants(p);

    const myUserId = session.user.id;
    const me = p.find((x) => x.user_id === myUserId);
    if (!m || !me) {
      setLoading(false);
      return;
    }

    const teammates = p.filter(
      (x) => x.user_id !== myUserId && x.side === me.side,
    );
    const opponentTeam =
      me.side === 'A' ? m.side_b : m.side_a;
    setOpponentTeamId(opponentTeam.id);
    setOpponentTeamName(opponentTeam.name);
    setOpponentTeamLogo(opponentTeam.photo_url);

    const [alreadyReviewed, mvpVote, selfRating, refereeRev, teamRev] =
      await Promise.all([
        fetchMyReviewsForMatch(id, myUserId),
        fetchMyMvpVote(id),
        fetchMySelfRating(id),
        m.referee_id && m.referee_id !== myUserId
          ? hasReviewedReferee(id, m.referee_id)
          : Promise.resolve(null),
        m.is_internal
          ? Promise.resolve(true)
          : hasReviewedTeam(id, opponentTeam.id),
      ]);

    setReviewsToDo(
      teammates.map((o) => ({
        user_id: o.user_id,
        name: o.profile?.name ?? 'Jogador',
        photo_url: o.profile?.photo_url ?? null,
        done: alreadyReviewed.has(o.user_id),
      })),
    );
    setOpponentTeamDone(teamRev);
    setMvpDone(mvpVote !== null);
    setSelfDone(selfRating !== null);
    setRefereeDone(refereeRev);
    const statsTasks: PlayerSubTask[] = await Promise.all(
      teammates.map(async (t) => {
        const pos = await fetchPreferredPosition(t.user_id);
        const cats = categoriesForPosition(pos);
        const votes = await fetchMyVotesFor(t.user_id);
        const allVoted = cats.every((c) => votes[c] !== undefined);
        return {
          user_id: t.user_id,
          name: t.profile?.name ?? 'Jogador',
          photo_url: t.profile?.photo_url ?? null,
          done: allVoted,
        };
      }),
    );
    setStatsToVote(statsTasks);
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <Screen>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: 'Pós-jogo',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>Jogo não encontrado.</Text>
        </View>
      </Screen>
    );
  }

  if (match.status !== 'validated') {
    return (
      <Screen>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: 'Pós-jogo',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>
            Este pós-jogo só fica disponível depois do resultado ser validado.
          </Text>
          <View style={{ marginTop: 16 }}>
            <Button
              label="Voltar ao jogo"
              variant="secondary"
              onPress={() => router.replace(`/(app)/matches/${id}`)}
            />
          </View>
        </View>
      </Screen>
    );
  }

  const reviewsDone = reviewsToDo.filter((r) => r.done).length;
  const reviewsTotal = reviewsToDo.length;
  const statsDone = statsToVote.filter((s) => s.done).length;
  const statsTotal = statsToVote.length;
  const hasReferee = refereeDone !== null;
  const hasOpponentTeam = !!opponentTeamName && !match.is_internal;

  const blocks = [
    { weight: reviewsTotal, done: reviewsDone },
    ...(hasOpponentTeam
      ? [{ weight: 1, done: opponentTeamDone ? 1 : 0 }]
      : []),
    { weight: 1, done: mvpDone ? 1 : 0 },
    { weight: 1, done: selfDone ? 1 : 0 },
    ...(hasReferee ? [{ weight: 1, done: refereeDone ? 1 : 0 }] : []),
    { weight: statsTotal, done: statsDone },
  ];
  const totalUnits = blocks.reduce((a, b) => a + b.weight, 0) || 1;
  const doneUnits = blocks.reduce((a, b) => a + b.done, 0);
  const pct = Math.round((doneUnits / totalUnits) * 100);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Pós-jogo',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
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
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <Eyebrow>{`${match.side_a.name} ${match.final_score_a ?? '—'} – ${match.final_score_b ?? '—'} ${match.side_b.name}`}</Eyebrow>
          <Heading level={2} style={{ marginTop: 6 }}>
            {pct === 100 ? 'Tudo concluído 👏' : `Pós-jogo · ${pct}%`}
          </Heading>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
        </Animated.View>

        {reviewsTotal > 0 && (
          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            style={styles.section}
          >
            <SectionHeader
              title={`Avaliar colegas · ${reviewsDone}/${reviewsTotal}`}
              cta="Avaliar"
              ctaPress={() => router.push(`/(app)/matches/${id}/review`)}
            />
            <Card style={{ marginTop: 8 }}>
              {reviewsToDo.map((r, i) => (
                <SubTaskRow
                  key={r.user_id}
                  photoUrl={r.photo_url}
                  name={r.name}
                  done={r.done}
                  border={i > 0}
                  onPress={() =>
                    !r.done && router.push(`/(app)/matches/${id}/review`)
                  }
                />
              ))}
            </Card>
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(120).springify()}
          style={styles.section}
        >
          <Eyebrow>Outros</Eyebrow>
          <Card style={{ marginTop: 8 }}>
            {opponentTeamName && !match.is_internal && (
              <SubTaskRow
                photoUrl={opponentTeamLogo}
                name={`Avaliar ${opponentTeamName}`}
                done={opponentTeamDone}
                border={false}
                onPress={() =>
                  !opponentTeamDone &&
                  router.push(`/(app)/matches/${id}/review`)
                }
              />
            )}
            <TopTaskRow
              icon="trophy"
              title="Votar MVP"
              done={mvpDone}
              border={opponentTeamName && !match.is_internal ? true : false}
              onPress={() => router.push(`/(app)/matches/${id}/mvp`)}
            />
            <TopTaskRow
              icon="person-circle-outline"
              title="Auto-avaliar"
              done={selfDone}
              border
              onPress={() => router.push(`/(app)/matches/${id}/self-rating`)}
            />
            {hasReferee && (
              <TopTaskRow
                icon="flag-outline"
                title="Avaliar árbitro"
                done={!!refereeDone}
                border
                onPress={() =>
                  router.push(`/(app)/matches/${id}/referee-review`)
                }
              />
            )}
          </Card>
        </Animated.View>

        {statsTotal > 0 && (
          <Animated.View
            entering={FadeInDown.delay(160).springify()}
            style={styles.section}
          >
            <Eyebrow>{`Atributos dos colegas · ${statsDone}/${statsTotal}`}</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              {statsToVote.map((s, i) => (
                <SubTaskRow
                  key={s.user_id}
                  photoUrl={s.photo_url}
                  name={s.name}
                  done={s.done}
                  border={i > 0}
                  onPress={() =>
                    router.push(`/(app)/users/${s.user_id}/stats-vote`)
                  }
                />
              ))}
            </Card>
          </Animated.View>
        )}

        {pct === 100 && (
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={{ marginTop: 24 }}
          >
            <Button
              label="Voltar ao jogo"
              size="lg"
              haptic="medium"
              onPress={() => router.replace(`/(app)/matches/${id}`)}
              full
            />
          </Animated.View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SectionHeader({
  title,
  cta,
  ctaPress,
}: {
  title: string;
  icon?: string;
  cta: string;
  ctaPress: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <Eyebrow>{title}</Eyebrow>
      <Pressable onPress={ctaPress}>
        <Text style={styles.sectionCta}>{cta} →</Text>
      </Pressable>
    </View>
  );
}

function SubTaskRow({
  photoUrl,
  name,
  done,
  border,
  onPress,
}: {
  photoUrl: string | null;
  name: string;
  done: boolean;
  border: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.taskRow, border && styles.taskRowBorder]}
    >
      <Avatar url={photoUrl} name={name} size={32} />
      <Text style={[styles.taskName, done && styles.taskDone]} numberOfLines={1}>
        {name}
      </Text>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={done ? colors.brand : colors.textDim}
      />
    </Pressable>
  );
}

function TopTaskRow({
  icon,
  iconColor,
  title,
  done,
  border,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  done: boolean;
  border: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.taskRow, border && styles.taskRowBorder]}
    >
      <View style={styles.taskIconWrap}>
        <Ionicons
          name={icon}
          size={18}
          color={iconColor ?? colors.goldDeep}
        />
      </View>
      <Text style={[styles.taskName, done && styles.taskDone]}>{title}</Text>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={done ? colors.brand : colors.textDim}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  muted: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.brand,
    borderRadius: 3,
  },
  section: { marginTop: 24 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionCta: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  taskRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  taskIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskIcon: {
    width: 32,
    height: 32,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 32,
  },
  taskName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  taskDone: {
    color: colors.textMuted,
    fontWeight: '500',
    textDecorationLine: 'line-through',
    textDecorationColor: colors.textDim,
  },
});
