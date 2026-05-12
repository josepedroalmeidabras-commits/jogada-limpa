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
          <Pressable
            style={styles.linkBtn}
            onPress={() => router.replace('/(app)')}
          >
            <Text style={styles.linkBtnText}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isCaptainA = match.side_a.captain_id === session?.user.id;
  const isCaptainB = match.side_b.captain_id === session?.user.id;
  const canAccept = match.status === 'proposed' && isCaptainB;
  const canReject = match.status === 'proposed' && (isCaptainA || isCaptainB);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Jogo',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.matchRow}>
          <View style={styles.teamBox}>
            <Text style={styles.teamName}>{match.side_a.name}</Text>
            <Text style={styles.teamCity}>{match.side_a.city}</Text>
          </View>
          <Text style={styles.vs}>vs</Text>
          <View style={styles.teamBox}>
            <Text style={styles.teamName}>{match.side_b.name}</Text>
            <Text style={styles.teamCity}>{match.side_b.city}</Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            match.status === 'confirmed' && styles.statusConfirmed,
            match.status === 'cancelled' && styles.statusCancelled,
          ]}
        >
          <Text style={styles.statusText}>{statusLabel(match.status)}</Text>
        </View>

        <View style={styles.infoBlock}>
          <InfoRow label="Quando" value={formatMatchDate(match.scheduled_at)} />
          <InfoRow
            label="Onde"
            value={
              match.location_tbd
                ? 'A combinar'
                : match.location_name ?? '—'
            }
          />
          {match.message && (
            <InfoRow label="Mensagem" value={match.message} />
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        {canAccept && (
          <Pressable
            onPress={handleAccept}
            disabled={acting}
            style={[styles.primary, acting && styles.btnDisabled]}
          >
            {acting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryText}>Aceitar desafio</Text>
            )}
          </Pressable>
        )}

        {canReject && (
          <Pressable
            onPress={handleReject}
            disabled={acting}
            style={[styles.secondary, acting && styles.btnDisabled]}
          >
            <Text style={styles.secondaryText}>
              {isCaptainB ? 'Recusar' : 'Cancelar proposta'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scroll: { padding: 24, paddingBottom: 48 },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  teamBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  teamName: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  teamCity: { color: '#a3a3a3', fontSize: 12, marginTop: 4 },
  vs: { color: '#737373', fontSize: 12, textTransform: 'uppercase' },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    marginBottom: 16,
  },
  statusConfirmed: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  statusCancelled: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
  statusText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  infoBlock: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  infoLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoValue: { color: '#ffffff', fontSize: 15 },
  primary: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
  linkBtn: { padding: 12 },
  linkBtnText: { color: '#ffffff', fontWeight: '600' },
})
