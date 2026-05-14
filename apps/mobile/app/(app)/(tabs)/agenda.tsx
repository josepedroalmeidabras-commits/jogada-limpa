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
  fetchMatchesForPlayer,
  formatMatchDate,
  formatRelativeMatchDate,
  statusLabel,
  type MatchSummary,
} from '@/lib/matches';
import { fetchMyTeams, isTeamLeader, type TeamWithSport } from '@/lib/teams';
import { Screen } from '@/components/Screen';
import { MatchKindSheet } from '@/components/MatchKindSheet';
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
  // null = "Meus jogos" (player participant). Otherwise = team id.
  const [scope, setScope] = useState<string | null>(null);
  const [playerMatches, setPlayerMatches] = useState<MatchSummary[]>([]);
  const [teamMatches, setTeamMatches] = useState<MatchSummary[]>([]);
  const [teams, setTeams] = useState<TeamWithSport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [pm, tm, t] = await Promise.all([
      fetchMatchesForPlayer(session.user.id),
      fetchMatchesForUser(session.user.id),
      fetchMyTeams(session.user.id),
    ]);
    setPlayerMatches(pm);
    setTeamMatches(tm);
    setTeams(t);
    setLoading(false);
  }, [session]);

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    const [pm, tm] = await Promise.all([
      fetchMatchesForPlayer(session.user.id),
      fetchMatchesForUser(session.user.id),
    ]);
    setPlayerMatches(pm);
    setTeamMatches(tm);
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
    if (scope === null) return playerMatches;
    return teamMatches.filter(
      (m) => m.side_a.id === scope || m.side_b.id === scope,
    );
  }, [scope, playerMatches, teamMatches]);

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

  const myLeaderTeams = teams.filter((t) => isTeamLeader(t, session?.user.id));
  const isLeader = myLeaderTeams.length > 0;

  const [matchKindOpen, setMatchKindOpen] = useState(false);

  function handleMarcarJogo() {
    if (myLeaderTeams.length === 0) return;
    setMatchKindOpen(true);
  }

  function handleMatchKindPick(kind: 'match' | 'internal' | 'open') {
    setMatchKindOpen(false);
    const go = (teamId: string) => {
      if (kind === 'match')
        router.push(`/(app)/teams/${teamId}/match/new`);
      else if (kind === 'internal')
        router.push(`/(app)/teams/${teamId}/internal/new`);
      else router.push(`/(app)/teams/${teamId}/open-request`);
    };
    if (myLeaderTeams.length === 1) {
      go(myLeaderTeams[0]!.id);
      return;
    }
    Alert.alert('Para que equipa?', 'Escolhe a equipa', [
      ...myLeaderTeams.map((t) => ({
        text: t.name,
        onPress: () => go(t.id),
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }

  return (
    <Screen>
      <MatchKindSheet
        visible={matchKindOpen}
        onClose={() => setMatchKindOpen(false)}
        onSelect={handleMatchKindPick}
      />
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
            {teams.length > 0 && (
              <Animated.View entering={FadeInDown.delay(50).springify()}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterRow}
                >
                  <Pressable
                    onPress={() => setScope(null)}
                    style={[
                      styles.filterChip,
                      scope === null && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        scope === null && styles.filterChipTextActive,
                      ]}
                    >
                      Meus jogos
                    </Text>
                  </Pressable>
                  {teams.map((t) => {
                    const active = scope === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setScope(t.id)}
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
              <Eyebrow>{`Próximos · ${grouped.upcoming.length}`}</Eyebrow>
              {grouped.upcoming.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Text style={styles.muted}>
                    {isLeader
                      ? 'Sem jogos agendados. Toca em "+" em baixo para marcar.'
                      : 'Sem jogos agendados. Quando o teu capitão marcar um jogo, aparece aqui.'}
                  </Text>
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
      {isLeader && !loading && (
        <Pressable style={styles.fab} onPress={handleMarcarJogo}>
          <Text style={styles.fabIcon}>+</Text>
          <Text style={styles.fabText}>Marcar jogo</Text>
        </Pressable>
      )}
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
  scroll: { padding: 24, paddingBottom: 120 },
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
  filterChipTextActive: { color: '#0E1812', fontWeight: '700' },
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 102,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: colors.brand,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  fabIcon: {
    color: '#0E1812',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22,
  },
  fabText: {
    color: '#0E1812',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
