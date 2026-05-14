import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen } from '@/components/Screen';
import { Heading } from '@/components/Heading';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { StarRating } from '@/components/StarRating';
import { colors } from '@/theme';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchMatchById, type MatchSummary } from '@/lib/matches';
import {
  fetchMatchParticipants,
  type MatchParticipant,
} from '@/lib/result';
import {
  fetchMyReviewsForMatch,
  hasReviewedTeam,
  submitReview,
  submitTeamReview,
} from '@/lib/reviews';

type Scores = {
  overall: number;
  comment: string;
};

function defaultScores(): Scores {
  return {
    overall: 5,
    comment: '',
  };
}

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [alreadyReviewed, setAlreadyReviewed] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Scores>>({});
  const [teamDraft, setTeamDraft] = useState<Scores>(defaultScores());
  const [teamDone, setTeamDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !session) return;
    const [m, p, done] = await Promise.all([
      fetchMatchById(id),
      fetchMatchParticipants(id),
      fetchMyReviewsForMatch(id, session.user.id),
    ]);
    setMatch(m);
    setParticipants(p);
    setAlreadyReviewed(done);
    const next: Record<string, Scores> = {};
    const myParticipant = p.find((x) => x.user_id === session.user.id);
    const mySide = myParticipant?.side;
    // Only teammates get individual review drafts
    for (const part of p) {
      if (
        part.user_id !== session.user.id &&
        part.side === mySide &&
        !done.has(part.user_id)
      ) {
        next[part.user_id] = defaultScores();
      }
    }
    setDrafts(next);
    // Check if team review already submitted
    if (m && mySide) {
      const opponentTeamId =
        mySide === 'A' ? m.side_b.id : m.side_a.id;
      const t = await hasReviewedTeam(id, opponentTeamId);
      setTeamDone(t);
    }
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </Screen>
    );
  }

  if (!match || !session) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>Jogo não encontrado.</Text>
        </View>
      </Screen>
    );
  }

  const mySide = participants.find((p) => p.user_id === session.user.id)?.side;
  const teammates = participants.filter(
    (p) => p.user_id !== session.user.id && p.side === mySide,
  );
  const opponentTeam =
    mySide === 'A' ? match.side_b : mySide === 'B' ? match.side_a : null;

  function updateScore(uid: string, key: keyof Scores, value: number | string) {
    setDrafts((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] ?? defaultScores()), [key]: value as never },
    }));
  }

  function updateTeamScore(key: keyof Scores, value: number | string) {
    setTeamDraft((prev) => ({ ...prev, [key]: value as never }));
  }

  async function handleTeamSubmit() {
    if (!opponentTeam || !match) return;
    setError(null);
    setSubmitting('__team__');
    const r = await submitTeamReview({
      match_id: match.id,
      team_id: opponentTeam.id,
      overall: teamDraft.overall,
      comment: teamDraft.comment.trim() || undefined,
    });
    setSubmitting(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setTeamDone(true);
  }

  async function handleSubmit(p: MatchParticipant) {
    if (!session) return;
    setError(null);
    setSubmitting(p.user_id);
    const draft = drafts[p.user_id] ?? defaultScores();
    const role: 'opponent' | 'teammate' =
      p.side === mySide ? 'teammate' : 'opponent';
    const r = await submitReview({
      match_id: match!.id,
      reviewed_id: p.user_id,
      role,
      overall: draft.overall,
      comment: draft.comment.trim() || undefined,
    });
    setSubmitting(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setAlreadyReviewed((prev) => new Set([...prev, p.user_id]));
  }

  const pending = teammates.filter((p) => !alreadyReviewed.has(p.user_id));
  const allDone = pending.length === 0 && (teamDone || !opponentTeam);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Avaliações',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(300).springify()}>
            <Heading level={2}>
              {`${match.side_a.name} vs ${match.side_b.name}`}
            </Heading>
            <Text style={styles.sub}>
              Avalia os teus colegas individualmente e a equipa adversária
              como um todo.
            </Text>
          </Animated.View>

          {opponentTeam && !teamDone && (
            <Animated.View
              entering={FadeInDown.delay(60).springify()}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <Avatar
                  url={opponentTeam.photo_url}
                  name={opponentTeam.name}
                  size={40}
                />
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardName}>{opponentTeam.name}</Text>
                  <Text style={styles.cardRole}>Equipa adversária</Text>
                </View>
              </View>
              <View style={styles.starsBlock}>
                <Text style={styles.starsLabel}>Avaliação geral</Text>
                <StarRating
                  value={teamDraft.overall}
                  onChange={(v) => updateTeamScore('overall', v)}
                  size={32}
                />
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="Comentário opcional (200 chars)"
                placeholderTextColor="#666"
                value={teamDraft.comment}
                onChangeText={(t) =>
                  updateTeamScore('comment', t.slice(0, 200))
                }
                multiline
                maxLength={200}
                editable={submitting !== '__team__'}
              />
              <View style={{ marginTop: 12 }}>
                <Button
                  label="Submeter avaliação à equipa"
                  loading={submitting === '__team__'}
                  onPress={handleTeamSubmit}
                  disabled={submitting !== null && submitting !== '__team__'}
                  full
                />
              </View>
            </Animated.View>
          )}

          {allDone ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneTitle}>Tudo avaliado 👍</Text>
              <Text style={styles.doneBody}>
                Já submeteste todas as avaliações deste jogo.
              </Text>
              <View style={{ marginTop: 12 }}>
                <Button
                  label="Voltar ao jogo"
                  onPress={() => router.replace(`/(app)/matches/${match.id}`)}
                />
              </View>
            </View>
          ) : (
            pending.map((p, i) => {
              const draft = drafts[p.user_id] ?? defaultScores();
              const role = p.side === mySide ? 'Colega' : 'Adversário';
              return (
                <Animated.View
                  key={p.user_id}
                  entering={FadeInDown.delay(80 + i * 40).springify()}
                  style={styles.card}
                >
                  <View style={styles.cardHeader}>
                    <Avatar url={p.profile?.photo_url} name={p.profile?.name} size={40} />
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardName}>
                        {p.profile?.name ?? 'Jogador'}
                      </Text>
                      <Text style={styles.cardRole}>{role}</Text>
                    </View>
                  </View>

                  <View style={styles.starsBlock}>
                    <Text style={styles.starsLabel}>Avaliação geral</Text>
                    <StarRating
                      value={draft.overall}
                      onChange={(v) => updateScore(p.user_id, 'overall', v)}
                      size={32}
                    />
                  </View>

                  <TextInput
                    style={styles.commentInput}
                    placeholder="Comentário opcional (200 chars)"
                    placeholderTextColor="#666"
                    value={draft.comment}
                    onChangeText={(t) =>
                      updateScore(p.user_id, 'comment', t.slice(0, 200))
                    }
                    multiline
                    maxLength={200}
                    editable={submitting !== p.user_id}
                  />

                  <View style={{ marginTop: 12 }}>
                    <Button
                      label="Submeter avaliação"
                      loading={submitting === p.user_id}
                      onPress={() => handleSubmit(p)}
                      disabled={submitting !== null && submitting !== p.user_id}
                      full
                    />
                  </View>
                </Animated.View>
              );
            })
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function CategoryRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.catRow}>
      <Text style={styles.catLabel}>{label}</Text>
      <View style={styles.catStars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} style={styles.starHit}>
            <Text style={[styles.star, n <= value && styles.starOn]}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E1812' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  heading: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardHeaderText: { marginLeft: 12, flex: 1 },
  cardName: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  cardRole: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontWeight: '700' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  catLabel: { color: '#d4d4d4', fontSize: 14, flex: 1 },
  catStars: { flexDirection: 'row', gap: 4 },
  starHit: { padding: 2 },
  star: { color: 'rgba(255,255,255,0.15)', fontSize: 22 },
  starOn: { color: colors.brand },
  starsBlock: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: colors.brandSoft,
    gap: 8,
  },
  starsLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  commentInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    minHeight: 60,
    marginTop: 12,
    textAlignVertical: 'top',
  },
  submit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#000000', fontSize: 15, fontWeight: '600' },
  doneBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.3)',
    backgroundColor: 'rgba(52,211,153,0.08)',
    alignItems: 'center',
    gap: 8,
  },
  doneTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  doneBody: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  primary: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  primaryText: { color: '#000', fontWeight: '600' },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
});
