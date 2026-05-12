import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchMatchesForUser,
  formatMatchDate,
  formatRelativeMatchDate,
  statusLabel,
  type MatchSummary,
} from '@/lib/matches';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';

export default function AgendaScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const data = await fetchMatchesForUser(session.user.id);
    setMatches(data);
    setLoading(false);
  }, [session]);

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    const data = await fetchMatchesForUser(session.user.id);
    setMatches(data);
    setRefreshing(false);
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

  return (
    <Screen edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton width={120} height={32} />
            <Skeleton height={70} radius={16} style={{ marginTop: 16 }} />
            <Skeleton height={70} radius={16} />
            <Skeleton height={70} radius={16} />
          </View>
        ) : (
          <>
            <Animated.View
              entering={FadeInDown.duration(300).springify()}
              style={styles.titleRow}
            >
              <Heading level={1}>Jogos</Heading>
              <Button
                label="Ranking"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/(app)/rankings')}
              />
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(80).springify()}
              style={styles.section}
            >
              <Eyebrow>{`Próximos · ${grouped.upcoming.length}`}</Eyebrow>
              {grouped.upcoming.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>Sem jogos agendados.</Text>
                </Card>
              ) : (
                grouped.upcoming.map((m, i) => (
                  <Animated.View
                    key={m.id}
                    entering={FadeInDown.delay(120 + i * 40).springify()}
                  >
                    <MatchCard
                      match={m}
                      onPress={() => router.push(`/(app)/matches/${m.id}`)}
                      whenRelative
                    />
                  </Animated.View>
                ))
              )}
            </Animated.View>

            {grouped.pendingResult.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(160).springify()}
                style={styles.section}
              >
                <Eyebrow>{`A pedir resultado · ${grouped.pendingResult.length}`}</Eyebrow>
                {grouped.pendingResult.map((m, i) => (
                  <Animated.View
                    key={m.id}
                    entering={FadeInDown.delay(200 + i * 40).springify()}
                  >
                    <MatchCard
                      match={m}
                      onPress={() => router.push(`/(app)/matches/${m.id}`)}
                      whenRelative
                    />
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(240).springify()}
              style={styles.section}
            >
              <Eyebrow>{`Validados · ${grouped.past.length}`}</Eyebrow>
              {grouped.past.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>Sem jogos validados ainda.</Text>
                </Card>
              ) : (
                grouped.past.map((m, i) => (
                  <Animated.View
                    key={m.id}
                    entering={FadeInDown.delay(280 + i * 30).springify()}
                  >
                    <MatchCard
                      match={m}
                      onPress={() => router.push(`/(app)/matches/${m.id}`)}
                    />
                  </Animated.View>
                ))
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function MatchCard({
  match,
  onPress,
  whenRelative,
}: {
  match: MatchSummary;
  onPress: () => void;
  whenRelative?: boolean;
}) {
  return (
    <Card onPress={onPress} style={{ marginTop: 8 }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.teams}>
            {`${match.side_a.name} vs ${match.side_b.name}`}
          </Text>
          <Text style={styles.meta}>
            {whenRelative
              ? formatRelativeMatchDate(match.scheduled_at)
              : formatMatchDate(match.scheduled_at)}
          </Text>
        </View>
        {match.status === 'validated' &&
        match.final_score_a !== null &&
        match.final_score_b !== null ? (
          <Text style={styles.score}>
            {`${match.final_score_a}–${match.final_score_b}`}
          </Text>
        ) : (
          <StatusPill status={match.status} />
        )}
      </View>
    </Card>
  );
}

function StatusPill({ status }: { status: MatchSummary['status'] }) {
  const bg =
    status === 'confirmed'
      ? 'rgba(52,211,153,0.12)'
      : status === 'cancelled' || status === 'disputed'
        ? 'rgba(248,113,113,0.12)'
        : 'rgba(251,191,36,0.12)';
  const fg =
    status === 'confirmed'
      ? '#34d399'
      : status === 'cancelled' || status === 'disputed'
        ? '#f87171'
        : '#fbbf24';
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700' }}>
        {statusLabel(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  section: { marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teams: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  meta: { color: '#a3a3a3', fontSize: 12, marginTop: 2, letterSpacing: -0.1 },
  score: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  muted: { color: '#737373', fontSize: 13 },
});
