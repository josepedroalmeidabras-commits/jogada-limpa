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
import { SafeAreaView } from 'react-native-safe-area-context';
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
  submitReview,
} from '@/lib/reviews';

type Scores = {
  fair_play: number;
  punctuality: number;
  technical_level: number;
  attitude: number;
  comment: string;
};

function defaultScores(): Scores {
  return {
    fair_play: 3,
    punctuality: 3,
    technical_level: 3,
    attitude: 3,
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
    for (const part of p) {
      if (part.user_id !== session.user.id && !done.has(part.user_id)) {
        next[part.user_id] = defaultScores();
      }
    }
    setDrafts(next);
    setLoading(false);
  }, [id, session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </SafeAreaView>
    );
  }

  if (!match || !session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>Jogo não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mySide = participants.find((p) => p.user_id === session.user.id)?.side;
  const others = participants.filter((p) => p.user_id !== session.user.id);

  function updateScore(uid: string, key: keyof Scores, value: number | string) {
    setDrafts((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] ?? defaultScores()), [key]: value as never },
    }));
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
      fair_play: draft.fair_play,
      punctuality: draft.punctuality,
      technical_level: draft.technical_level,
      attitude: draft.attitude,
      comment: draft.comment.trim() || undefined,
    });
    setSubmitting(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setAlreadyReviewed((prev) => new Set([...prev, p.user_id]));
  }

  const pending = others.filter((p) => !alreadyReviewed.has(p.user_id));

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Avaliações',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.heading}>
            {match.side_a.name} vs {match.side_b.name}
          </Text>
          <Text style={styles.sub}>
            Avalia os outros jogadores. Visível só depois de bilateral ou 72h.
          </Text>

          {pending.length === 0 ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneTitle}>Tudo avaliado 👍</Text>
              <Text style={styles.doneBody}>
                Já submeteste avaliações para todos os jogadores deste jogo.
              </Text>
              <Pressable
                style={styles.primary}
                onPress={() => router.replace(`/(app)/matches/${match.id}`)}
              >
                <Text style={styles.primaryText}>Voltar ao jogo</Text>
              </Pressable>
            </View>
          ) : (
            pending.map((p) => {
              const draft = drafts[p.user_id] ?? defaultScores();
              const role = p.side === mySide ? 'Colega' : 'Adversário';
              return (
                <View key={p.user_id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(p.profile?.name ?? '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardName}>
                        {p.profile?.name ?? 'Jogador'}
                      </Text>
                      <Text style={styles.cardRole}>{role}</Text>
                    </View>
                  </View>

                  <CategoryRow
                    label="Fair play"
                    value={draft.fair_play}
                    onChange={(v) => updateScore(p.user_id, 'fair_play', v)}
                  />
                  <CategoryRow
                    label="Pontualidade"
                    value={draft.punctuality}
                    onChange={(v) => updateScore(p.user_id, 'punctuality', v)}
                  />
                  <CategoryRow
                    label="Nível técnico"
                    value={draft.technical_level}
                    onChange={(v) =>
                      updateScore(p.user_id, 'technical_level', v)
                    }
                  />
                  <CategoryRow
                    label="Atitude"
                    value={draft.attitude}
                    onChange={(v) => updateScore(p.user_id, 'attitude', v)}
                  />

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

                  <Pressable
                    style={[
                      styles.submit,
                      submitting === p.user_id && styles.submitDisabled,
                    ]}
                    onPress={() => handleSubmit(p)}
                    disabled={submitting !== null}
                  >
                    {submitting === p.user_id ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.submitText}>Submeter avaliação</Text>
                    )}
                  </Pressable>
                </View>
              );
            })
          )}

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  heading: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#a3a3a3', fontSize: 13, marginTop: 4, marginBottom: 16 },
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
  cardRole: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
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
  starOn: { color: '#fbbf24' },
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
  doneBody: { color: '#a3a3a3', textAlign: 'center', fontSize: 14 },
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
