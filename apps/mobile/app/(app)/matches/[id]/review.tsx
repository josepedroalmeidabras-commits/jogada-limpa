import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { hasReviewedTeam, submitTeamReview } from '@/lib/reviews';

type TeamScores = {
  overall: number;
  comment: string;
};

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [teamDraft, setTeamDraft] = useState<TeamScores>({
    overall: 5,
    comment: '',
  });
  const [teamDone, setTeamDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !session) return;
    const m = await fetchMatchById(id);
    setMatch(m);

    if (m) {
      const iAmCaptainA = m.side_a.captain_id === session.user.id;
      const iAmCaptainB = m.side_b.captain_id === session.user.id;
      const opponentTeamId = iAmCaptainA
        ? m.side_b.id
        : iAmCaptainB
          ? m.side_a.id
          : null;
      if (opponentTeamId) {
        const done = await hasReviewedTeam(id, opponentTeamId);
        setTeamDone(done);
      }
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

  const iAmCaptainA = match.side_a.captain_id === session.user.id;
  const iAmCaptainB = match.side_b.captain_id === session.user.id;
  const iAmCaptain = iAmCaptainA || iAmCaptainB;
  const opponentTeam = iAmCaptainA
    ? match.side_b
    : iAmCaptainB
      ? match.side_a
      : null;

  function updateTeamScore(key: keyof TeamScores, value: number | string) {
    setTeamDraft((prev) => ({ ...prev, [key]: value as never }));
  }

  async function handleTeamSubmit() {
    if (!opponentTeam || !match) return;
    setError(null);
    setSubmitting(true);
    const r = await submitTeamReview({
      match_id: match.id,
      team_id: opponentTeam.id,
      overall: teamDraft.overall,
      comment: teamDraft.comment.trim() || undefined,
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setTeamDone(true);
  }

  // Peladinha: não há equipa adversária para avaliar
  if (match.is_internal) {
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
        <View style={styles.center}>
          <Text style={styles.infoTitle}>Sem avaliação de equipa</Text>
          <Text style={styles.infoBody}>
            Em peladinhas internas, só MVP é votado. Volta ao jogo para
            escolher o teu MVP.
          </Text>
          <View style={{ marginTop: 16 }}>
            <Button
              label="Votar MVP"
              onPress={() => router.replace(`/(app)/matches/${match.id}/mvp`)}
              full
            />
          </View>
        </View>
      </Screen>
    );
  }

  // Não-capitão: redireciona para MVP (não pode avaliar equipa)
  if (!iAmCaptain || !opponentTeam) {
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
        <View style={styles.center}>
          <Text style={styles.infoTitle}>Só o capitão avalia a equipa</Text>
          <Text style={styles.infoBody}>
            A avaliação da equipa adversária fica reservada ao capitão da
            tua equipa. Tu podes votar no MVP do jogo.
          </Text>
          <View style={{ marginTop: 16 }}>
            <Button
              label="Votar MVP"
              onPress={() => router.replace(`/(app)/matches/${match.id}/mvp`)}
              full
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Avaliar equipa',
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
              Como capitão, avalia a equipa adversária como um todo (fair-play,
              pontualidade, nível técnico).
            </Text>
          </Animated.View>

          {teamDone ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneTitle}>Avaliação enviada 👍</Text>
              <Text style={styles.doneBody}>
                A tua avaliação da {opponentTeam.name} foi registada.
              </Text>
              <View style={{ marginTop: 12 }}>
                <Button
                  label="Voltar ao jogo"
                  onPress={() => router.replace(`/(app)/matches/${match.id}`)}
                />
              </View>
            </View>
          ) : (
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
                editable={!submitting}
              />
              <View style={{ marginTop: 12 }}>
                <Button
                  label="Submeter avaliação"
                  loading={submitting}
                  onPress={handleTeamSubmit}
                  full
                />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scroll: { padding: 24, paddingBottom: 64 },
  sub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeaderText: { flex: 1 },
  cardName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardRole: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  starsBlock: { marginTop: 16, gap: 8 },
  starsLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  commentInput: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSubtle,
    color: colors.text,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  doneBox: {
    marginTop: 24,
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    alignItems: 'center',
  },
  doneTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  doneBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  infoBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
});
