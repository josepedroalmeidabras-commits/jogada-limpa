import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';
import {
  fetchReviewAggregate,
  fetchUserSports,
  type ReviewAggregate,
  type UserSportElo,
} from '@/lib/reviews';
import {
  fetchUserMatchHistory,
  type MatchHistoryEntry,
} from '@/lib/history';
import { formatMatchDate } from '@/lib/matches';

function levelLabel(elo: number): string {
  if (elo < 1100) return 'Casual';
  if (elo < 1300) return 'Intermédio';
  if (elo < 1500) return 'Avançado';
  return 'Competitivo';
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sports, setSports] = useState<UserSportElo[]>([]);
  const [aggregate, setAggregate] = useState<ReviewAggregate | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const [p, s, a, h] = await Promise.all([
      fetchProfile(session.user.id),
      fetchUserSports(session.user.id),
      fetchReviewAggregate(session.user.id),
      fetchUserMatchHistory(session.user.id, 10),
    ]);
    setProfile(p);
    setSports(s);
    setAggregate(a);
    setHistory(h);
    setLoading(false);
  }, [session]);

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

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Perfil',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerBlock}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>
              {(profile?.name ?? '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.name}</Text>
          <Text style={styles.city}>{profile?.city}</Text>
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>

        <Text style={styles.section}>ELO por desporto</Text>
        {sports.length === 0 ? (
          <Text style={styles.empty}>Sem desportos no perfil.</Text>
        ) : (
          sports.map((s) => (
            <View key={s.sport_id} style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowName}>{s.sport?.name}</Text>
                <Text style={styles.rowMeta}>
                  {levelLabel(s.elo)} · {s.matches_played} jogos
                </Text>
              </View>
              <Text style={styles.rowValue}>{Math.round(s.elo)}</Text>
            </View>
          ))
        )}

        <Text style={[styles.section, { marginTop: 24 }]}>Reputação</Text>
        {aggregate ? (
          <View style={styles.aggBlock}>
            <AggBar label="Fair play" value={aggregate.avg_fair_play} />
            <AggBar label="Pontualidade" value={aggregate.avg_punctuality} />
            <AggBar label="Nível técnico" value={aggregate.avg_technical_level} />
            <AggBar label="Atitude" value={aggregate.avg_attitude} />
            <Text style={styles.aggFoot}>
              {aggregate.total_reviews} avaliação(ões) recebidas
            </Text>
          </View>
        ) : (
          <Text style={styles.empty}>
            Em construção — joga mais jogos para ver a tua reputação.
          </Text>
        )}

        <Text style={[styles.section, { marginTop: 24 }]}>Histórico</Text>
        {history.length === 0 ? (
          <Text style={styles.empty}>Sem jogos validados ainda.</Text>
        ) : (
          history.map((h) => (
            <Pressable
              key={h.match_id}
              style={styles.matchRow}
              onPress={() => router.push(`/(app)/matches/${h.match_id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.matchTeams}>
                  {h.my_team_name} vs {h.opponent_team_name}
                </Text>
                <Text style={styles.matchMeta}>
                  {h.sport_name} · {formatMatchDate(h.scheduled_at)}
                </Text>
              </View>
              <View style={styles.matchScore}>
                <Text
                  style={[
                    styles.matchResult,
                    h.result === 'win' && styles.resultWin,
                    h.result === 'loss' && styles.resultLoss,
                  ]}
                >
                  {h.my_side === 'A'
                    ? `${h.final_score_a}–${h.final_score_b}`
                    : `${h.final_score_b}–${h.final_score_a}`}
                </Text>
                <Text style={styles.matchResultLabel}>
                  {h.result === 'win'
                    ? 'V'
                    : h.result === 'loss'
                      ? 'D'
                      : 'E'}
                </Text>
              </View>
            </Pressable>
          ))
        )}

        <Pressable
          style={styles.signOut}
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/login');
          }}
        >
          <Text style={styles.signOutText}>Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function AggBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value / 5));
  return (
    <View style={styles.aggRow}>
      <View style={styles.aggHeader}>
        <Text style={styles.aggLabel}>{label}</Text>
        <Text style={styles.aggValue}>{value.toFixed(1)} / 5</Text>
      </View>
      <View style={styles.aggTrack}>
        <View style={[styles.aggFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  bigAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  bigAvatarText: { color: '#ffffff', fontSize: 32, fontWeight: '800' },
  name: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  city: { color: '#a3a3a3', fontSize: 14 },
  email: { color: '#737373', fontSize: 12 },
  section: {
    color: '#a3a3a3',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  rowLeft: { flex: 1 },
  rowName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  rowMeta: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  rowValue: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  aggBlock: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  aggRow: { marginBottom: 12 },
  aggHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  aggLabel: { color: '#d4d4d4', fontSize: 13 },
  aggValue: { color: '#a3a3a3', fontSize: 12 },
  aggTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  aggFill: { height: '100%', backgroundColor: '#fbbf24' },
  aggFoot: {
    color: '#737373',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  matchTeams: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  matchMeta: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  matchScore: { alignItems: 'flex-end' },
  matchResult: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  matchResultLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  resultWin: { color: '#34d399' },
  resultLoss: { color: '#f87171' },
  signOut: {
    marginTop: 40,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: { color: '#737373', fontSize: 13 },
});
