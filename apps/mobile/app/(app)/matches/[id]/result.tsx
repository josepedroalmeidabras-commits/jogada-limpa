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
  submitMatchSideResult,
  type MatchParticipant,
} from '@/lib/result';

export default function SubmitResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [attended, setAttended] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [m, p] = await Promise.all([
      fetchMatchById(id),
      fetchMatchParticipants(id),
    ]);
    setMatch(m);
    setParticipants(p);
    setLoading(false);
  }, [id]);

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

  if (!match) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>Jogo não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const userId = session?.user.id;
  const isCaptainA = match.side_a.captain_id === userId;
  const isCaptainB = match.side_b.captain_id === userId;
  if (!isCaptainA && !isCaptainB) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>Só os capitães submetem resultados.</Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => router.replace(`/(app)/matches/${match.id}`)}
          >
            <Text style={styles.linkBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const mySide: 'A' | 'B' = isCaptainA ? 'A' : 'B';
  const myParticipants = participants.filter((p) => p.side === mySide);

  function toggleAttendance(uid: string) {
    setAttended((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function handleSubmit() {
    setError(null);
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 0 || b < 0) {
      setError('Resultados inválidos.');
      return;
    }
    if (attended.size === 0) {
      setError('Marca pelo menos um jogador como presente.');
      return;
    }
    setSubmitting(true);
    const r = await submitMatchSideResult({
      match_id: match!.id,
      score_a: a,
      score_b: b,
      attended_user_ids: Array.from(attended),
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.replace(`/(app)/matches/${match!.id}`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Submeter resultado',
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
          <Text style={styles.sub}>Submetes pelo lado {mySide}.</Text>

          <Text style={styles.label}>Resultado final</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreTeam}>{match.side_a.name}</Text>
              <TextInput
                style={styles.scoreInput}
                value={scoreA}
                onChangeText={(t) => setScoreA(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0"
                placeholderTextColor="#444"
                editable={!submitting}
              />
            </View>
            <Text style={styles.scoreDash}>—</Text>
            <View style={styles.scoreBox}>
              <Text style={styles.scoreTeam}>{match.side_b.name}</Text>
              <TextInput
                style={styles.scoreInput}
                value={scoreB}
                onChangeText={(t) => setScoreB(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={3}
                placeholder="0"
                placeholderTextColor="#444"
                editable={!submitting}
              />
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 24 }]}>
            Quem jogou (lado {mySide})
          </Text>
          {myParticipants.length === 0 ? (
            <Text style={styles.empty}>Nenhum jogador disponível.</Text>
          ) : (
            myParticipants.map((p) => {
              const picked = attended.has(p.user_id);
              return (
                <Pressable
                  key={p.user_id}
                  onPress={() => toggleAttendance(p.user_id)}
                  disabled={submitting}
                  style={[styles.playerRow, picked && styles.playerRowPicked]}
                >
                  <View
                    style={[styles.check, picked && styles.checkOn]}
                  >
                    {picked && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.playerName}>
                    {p.profile?.name ?? 'Jogador'}
                  </Text>
                </Pressable>
              );
            })
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submit, submitting && styles.submitDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Submeter</Text>
            )}
          </Pressable>

          <Text style={styles.hint}>
            Quando ambos os capitães submeterem o mesmo resultado, o jogo
            valida automaticamente e o ELO é atualizado.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scroll: { padding: 24, paddingBottom: 48 },
  heading: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#a3a3a3', fontSize: 13, marginTop: 4, marginBottom: 16 },
  label: {
    color: '#a3a3a3',
    fontSize: 13,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  scoreTeam: { color: '#a3a3a3', fontSize: 11, textTransform: 'uppercase' },
  scoreInput: {
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    minWidth: 60,
  },
  scoreDash: { color: '#737373', fontSize: 28, fontWeight: '700' },
  empty: {
    color: '#737373',
    fontSize: 13,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  playerRowPicked: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.3)',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#34d399', borderColor: '#34d399' },
  checkMark: { color: '#000000', fontWeight: '800', fontSize: 14 },
  playerName: { color: '#ffffff', fontSize: 15 },
  submit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  hint: {
    color: '#737373',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
  linkBtn: { padding: 12 },
  linkBtnText: { color: '#ffffff', fontWeight: '600' },
});
