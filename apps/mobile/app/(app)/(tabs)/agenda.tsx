import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
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
import { fetchMyTeams, type TeamWithSport } from '@/lib/teams';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import {
  MatchListItem,
  MatchListGroup,
} from '@/components/MatchListItem';
import { addMatchesBulkToCalendar } from '@/lib/calendar';
import { colors } from '@/theme';

export default function AgendaScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [teams, setTeams] = useState<TeamWithSport[]>([]);
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [data, t] = await Promise.all([
      fetchMatchesForUser(session.user.id),
      fetchMyTeams(session.user.id),
    ]);
    setMatches(data);
    setTeams(t);
    setLoading(false);
  }, [session]);

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    const data = await fetchMatchesForUser(session.user.id);
    setMatches(data);
    setRefreshing(false);
  }, [session]);

  const [syncing, setSyncing] = useState(false);
  async function handleSyncCalendar(items: MatchSummary[]) {
    setSyncing(true);
    const events = items.map((m) => ({
      title: `${m.side_a.name} vs ${m.side_b.name}`,
      scheduled_at: m.scheduled_at,
      location: m.location_tbd
        ? 'A combinar'
        : (m.location_name ?? undefined),
    }));
    const r = await addMatchesBulkToCalendar(events);
    setSyncing(false);
    if (!r.ok) {
      Alert.alert('Calendário', r.message);
      return;
    }
    Alert.alert(
      'Sincronizado',
      `${r.added} jogo${r.added === 1 ? '' : 's'} adicionado${r.added === 1 ? '' : 's'} ao teu calendário.`,
    );
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredMatches = useMemo(() => {
    if (!teamFilter) return matches;
    return matches.filter(
      (m) => m.side_a.id === teamFilter || m.side_b.id === teamFilter,
    );
  }, [matches, teamFilter]);

  const grouped = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: filteredMatches.filter(
        (m) =>
          new Date(m.scheduled_at).getTime() >= now &&
          m.status !== 'cancelled' &&
          m.status !== 'validated',
      ),
      pendingResult: filteredMatches.filter(
        (m) =>
          new Date(m.scheduled_at).getTime() < now &&
          (m.status === 'confirmed' ||
            m.status === 'result_pending' ||
            m.status === 'disputed'),
      ),
      past: filteredMatches.filter((m) => m.status === 'validated'),
    };
  }, [filteredMatches]);

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

            {teams.length > 1 && (
              <Animated.View entering={FadeInDown.delay(50).springify()}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  <Pressable
                    onPress={() => setTeamFilter(null)}
                    style={[
                      styles.filterChip,
                      teamFilter === null && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        teamFilter === null && styles.filterChipTextActive,
                      ]}
                    >
                      Todas
                    </Text>
                  </Pressable>
                  {teams.map((t) => {
                    const active = teamFilter === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setTeamFilter(t.id)}
                        style={[
                          styles.filterChip,
                          active && styles.filterChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            active && styles.filterChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {t.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(80).springify()}
              style={styles.section}
            >
              <View style={styles.sectionHeader}>
                <Eyebrow>{`Próximos · ${grouped.upcoming.length}`}</Eyebrow>
                {grouped.upcoming.length > 0 && (
                  <Pressable
                    onPress={() => handleSyncCalendar(grouped.upcoming)}
                    disabled={syncing}
                    style={[styles.syncBtn, syncing && { opacity: 0.5 }]}
                  >
                    <Text style={styles.syncBtnText}>
                      {syncing ? '...' : '📅 Sincronizar'}
                    </Text>
                  </Pressable>
                )}
              </View>
              {grouped.upcoming.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>Sem jogos agendados.</Text>
                </Card>
              ) : (
                <Animated.View
                  entering={FadeInDown.delay(120).springify()}
                  style={{ marginTop: 8 }}
                >
                  <MatchListGroup>
                    {grouped.upcoming.map((m) => (
                      <MatchListItem
                        key={m.id}
                        match={m}
                        onPress={() => router.push(`/(app)/matches/${m.id}`)}
                      />
                    ))}
                  </MatchListGroup>
                </Animated.View>
              )}
            </Animated.View>

            {grouped.pendingResult.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(160).springify()}
                style={styles.section}
              >
                <Eyebrow>{`A pedir resultado · ${grouped.pendingResult.length}`}</Eyebrow>
                <Animated.View
                  entering={FadeInDown.delay(200).springify()}
                  style={{ marginTop: 8 }}
                >
                  <MatchListGroup>
                    {grouped.pendingResult.map((m) => (
                      <MatchListItem
                        key={m.id}
                        match={m}
                        onPress={() => router.push(`/(app)/matches/${m.id}`)}
                      />
                    ))}
                  </MatchListGroup>
                </Animated.View>
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
                <Animated.View
                  entering={FadeInDown.delay(280).springify()}
                  style={{ marginTop: 8 }}
                >
                  <MatchListGroup>
                    {grouped.past.map((m) => (
                      <MatchListItem
                        key={m.id}
                        match={m}
                        onPress={() => router.push(`/(app)/matches/${m.id}`)}
                      />
                    ))}
                  </MatchListGroup>
                </Animated.View>
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
  filterRow: { gap: 6, paddingVertical: 12 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    maxWidth: 200,
  },
  filterChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  filterChipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: { color: '#0a0a0a', fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  syncBtnText: { color: colors.brand, fontSize: 11, fontWeight: '700' },
});
