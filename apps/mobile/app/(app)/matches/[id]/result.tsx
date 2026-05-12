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
import { Screen } from '@/components/Screen';
import { Heading } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

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
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>Jogo não encontrado.</Text>
        </View>
      </Screen>
    );
  }

  const userId = session?.user.id;
  const isCaptainA = match.side_a.captain_id === userId;
  const isCaptainB = match.side_b.captain_id === userId;
  if (!isCaptainA && !isCaptainB) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>Só os capitães submetem resultados.</Text>
          <Button
            label="Voltar"
            variant="secondary"
            onPress={() => router.replace(`/(app)/matches/${match.id}`)}
          />
        </View>
      </Screen>
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
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Submeter resultado',
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
            <Text style={styles.sub}>{`Submetes pelo lado ${mySide}.`}</Text>
          </Animated.View>

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

          <Button
            label="Submeter"
            size="lg"
            haptic="medium"
            loading={submitting}
            onPress={handleSubmit}
            full
          />

          <Text style={styles.hint}>
            Quando ambos os capitães submeterem o mesmo resultado, o jogo
            valida automaticamente e o ELO é atualizado.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
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
    backgroundColor: colors.brandSoft,
    borderColor: colors.brandSoftBorder,
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
  checkOn: { backgroundColor: colors.brand, borderColor: colors.brand },
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
