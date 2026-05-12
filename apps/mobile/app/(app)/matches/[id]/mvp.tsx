import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
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
import { fetchMatchById, type MatchSummary } from '@/lib/matches';
import {
  fetchMatchParticipants,
  type MatchParticipant,
} from '@/lib/result';
import { castMvpVote, fetchMyMvpVote } from '@/lib/mvp';
import { Screen } from '@/components/Screen';
import { Heading } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { colors } from '@/theme';

export default function VoteMvpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [m, p, mv] = await Promise.all([
      fetchMatchById(id),
      fetchMatchParticipants(id),
      fetchMyMvpVote(id),
    ]);
    setMatch(m);
    setParticipants(p);
    setMyVote(mv);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleVote() {
    if (!selected || !match) return;
    setError(null);
    setSubmitting(true);
    const r = await castMvpVote({
      match_id: match.id,
      mvp_user_id: selected,
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setMyVote(selected);
    setTimeout(() => router.replace(`/(app)/matches/${match.id}`), 700);
  }

  if (loading || !match) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </Screen>
    );
  }

  const eligible = participants.filter(
    (p) =>
      p.user_id !== session?.user.id &&
      (p.attendance === 'attended' || p.attendance === 'substitute_in'),
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Votar MVP',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <Heading level={2}>
            {`${match.side_a.name} vs ${match.side_b.name}`}
          </Heading>
          <Text style={styles.sub}>
            Quem foi o melhor em campo? Um voto por jogo.
          </Text>
        </Animated.View>

        {myVote && (
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Card variant="success" style={{ marginTop: 16 }}>
              <Text style={styles.voted}>
                ✓ Já votaste neste jogo.
              </Text>
            </Card>
          </Animated.View>
        )}

        {eligible.map((p, i) => {
          const picked = selected === p.user_id;
          const isMyVote = myVote === p.user_id;
          return (
            <Animated.View
              key={p.user_id}
              entering={FadeInDown.delay(120 + i * 30).springify()}
            >
              <Pressable
                onPress={() => !myVote && setSelected(p.user_id)}
                disabled={!!myVote || submitting}
                style={[
                  styles.row,
                  picked && styles.rowPicked,
                  isMyVote && styles.rowVoted,
                ]}
              >
                <Avatar
                  url={p.profile?.photo_url}
                  name={p.profile?.name}
                  size={44}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>
                    {p.profile?.name ?? 'Jogador'}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {`Lado ${p.side}`}
                  </Text>
                </View>
                {(picked || isMyVote) && (
                  <Text style={styles.crown}>👑</Text>
                )}
              </Pressable>
            </Animated.View>
          );
        })}

        {error && <Text style={styles.error}>{error}</Text>}

        {!myVote && (
          <View style={{ marginTop: 24 }}>
            <Button
              label="Confirmar voto"
              size="lg"
              haptic="medium"
              loading={submitting}
              disabled={!selected}
              onPress={handleVote}
              full
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  sub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 8,
  },
  voted: { color: colors.success, fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: 8,
  },
  rowPicked: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  rowVoted: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  rowName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  crown: { fontSize: 22 },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
});
