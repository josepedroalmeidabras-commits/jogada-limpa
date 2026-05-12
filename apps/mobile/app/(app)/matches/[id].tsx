import { useCallback, useState } from 'react';
import {
  Alert,
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
  rejectMatch,
  statusLabel,
  type MatchSummary,
} from '@/lib/matches';
import { addMatchToCalendar } from '@/lib/calendar';
import { Screen } from '@/components/Screen';
import { Heading } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const m = await fetchMatchById(id);
    setMatch(m);
    setLoading(false);
  }, [id]);

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
            <View style={styles.scoreboard}>
              <Side
                name={match.side_a.name}
                score={match.final_score_a}
                onPress={() => router.push(`/(app)/teams/${match.side_a.id}`)}
              />
              <Text style={styles.vs}>vs</Text>
              <Side
                name={match.side_b.name}
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

        {error && <Text style={styles.error}>{error}</Text>}

        <Animated.View entering={FadeInDown.delay(140).springify()} style={styles.actions}>
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
  section: { marginTop: 16 },
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
