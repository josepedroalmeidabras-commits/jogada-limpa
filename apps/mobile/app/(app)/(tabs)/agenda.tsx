import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchMatchesForUser,
  formatMatchDate,
  statusLabel,
  type MatchSummary,
} from '@/lib/matches';

export default function AgendaScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const data = await fetchMatchesForUser(session.user.id);
    setMatches(data);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: matches.filter(
        (m) =>
          new Date(m.scheduled_at).getTime() >= now &&
          m.status !== 'cancelled' &&
          m.status !== 'validated',
      ),
      pendingResult: matches.filter(
        (m) =>
          new Date(m.scheduled_at).getTime() < now &&
          (m.status === 'confirmed' ||
            m.status === 'result_pending' ||
            m.status === 'disputed'),
      ),
      past: matches.filter((m) => m.status === 'validated'),
    };
  }, [matches]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Jogos</Text>
          <Pressable
            style={styles.rankingBtn}
            onPress={() => router.push('/(app)/rankings')}
          >
            <Text style={styles.rankingBtnText}>Ranking</Text>
          </Pressable>
        </View>

        <Section title={`Próximos (${grouped.upcoming.length})`}>
          {grouped.upcoming.length === 0 ? (
            <Empty text="Sem jogos agendados." />
          ) : (
            grouped.upcoming.map((m) => (
              <MatchRow key={m.id} match={m} onPress={() => router.push(`/(app)/matches/${m.id}`)} />
            ))
          )}
        </Section>

        {grouped.pendingResult.length > 0 && (
          <Section title={`A pedir resultado (${grouped.pendingResult.length})`}>
            {grouped.pendingResult.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                onPress={() => router.push(`/(app)/matches/${m.id}`)}
              />
            ))}
          </Section>
        )}

        <Section title={`Validados (${grouped.past.length})`}>
          {grouped.past.length === 0 ? (
            <Empty text="Sem jogos validados ainda." />
          ) : (
            grouped.past.map((m) => (
              <MatchRow key={m.id} match={m} onPress={() => router.push(`/(app)/matches/${m.id}`)} />
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.section}>{title}</Text>
      {children}
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

function MatchRow({
  match,
  onPress,
}: {
  match: MatchSummary;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.teams}>
          {match.side_a.name} vs {match.side_b.name}
        </Text>
        <Text style={styles.meta}>{formatMatchDate(match.scheduled_at)}</Text>
      </View>
      {match.status === 'validated' &&
      match.final_score_a !== null &&
      match.final_score_b !== null ? (
        <Text style={styles.score}>
          {match.final_score_a}–{match.final_score_b}
        </Text>
      ) : (
        <View
          style={[
            styles.statusBadge,
            match.status === 'confirmed' && styles.statusConfirmed,
            (match.status === 'cancelled' || match.status === 'disputed') &&
              styles.statusCancelled,
          ]}
        >
          <Text style={styles.statusText}>{statusLabel(match.status)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 32 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  rankingBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rankingBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  section: {
    color: '#a3a3a3',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  empty: {
    color: '#737373',
    fontSize: 13,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  teams: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  score: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  statusConfirmed: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  statusCancelled: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  statusText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
});
