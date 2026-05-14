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
import { Screen } from '@/components/Screen';
import { Heading } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { colors } from '@/theme';
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
  fetchOpenSubstitutes,
  inviteSubstitute,
  type OpenSubstitute,
} from '@/lib/result';

export default function SubstitutesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [subs, setSubs] = useState<OpenSubstitute[]>([]);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const m = await fetchMatchById(id);
    if (!m) {
      setLoading(false);
      return;
    }
    setMatch(m);
    const parts = await fetchMatchParticipants(m.id);
    const existingIds = parts.map((p) => p.user_id);
    setExcludeIds(existingIds);
    const list = await fetchOpenSubstitutes(m.sport_id, existingIds);
    setSubs(list);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function invite(userId: string, side: 'A' | 'B') {
    if (!match) return;
    setError(null);
    setPending(userId);
    const r = await inviteSubstitute({
      match_id: match.id,
      user_id: userId,
      side,
    });
    setPending(null);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    // remove from list locally
    setSubs((prev) => prev.filter((s) => s.user_id !== userId));
    setExcludeIds((prev) => [...prev, userId]);
  }

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
          <Text style={styles.empty}>Jogo não encontrado.</Text>
        </View>
      </Screen>
    );
  }

  const isCaptainA = match.side_a.captain_id === session?.user.id;
  const isCaptainB = match.side_b.captain_id === session?.user.id;
  const mySide: 'A' | 'B' | null = isCaptainA ? 'A' : isCaptainB ? 'B' : null;
  const sideAName = match.is_internal
    ? (match.side_a_label ?? 'Coletes')
    : match.side_a.name;
  const sideBName = match.is_internal
    ? (match.side_b_label ?? 'Sem Coletes')
    : match.side_b.name;
  const mySideName = mySide === 'A' ? sideAName : sideBName;

  if (!mySide) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.empty}>
            Só capitães podem convidar substitutos.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Procurar substitutos',
          headerStyle: { backgroundColor: '#0E1812' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>
          {sideAName} vs {sideBName}
        </Text>
        <Text style={styles.sub}>
          Adiciona ao lado {mySide} ({mySideName}).
        </Text>

        {subs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Ninguém disponível</Text>
            <Text style={styles.emptyBody}>
              Ainda não há jogadores marcados como abertos a substituir neste
              desporto. Quando alguém ativar a disponibilidade no perfil,
              aparece aqui.
            </Text>
          </View>
        ) : (
          subs.map((s) => (
            <View key={s.user_id} style={styles.row}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => router.push(`/(app)/users/${s.user_id}`)}
              >
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.meta}>
                  {s.city}
                  {s.matches > 0
                    ? ` · ${Math.round(s.win_pct)}% vit. · ${s.matches} jogos`
                    : ' · sem jogos ainda'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => invite(s.user_id, mySide)}
                disabled={pending === s.user_id}
                style={[
                  styles.inviteBtn,
                  pending === s.user_id && styles.inviteBtnDisabled,
                ]}
              >
                {pending === s.user_id ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.inviteText}>Convidar</Text>
                )}
              </Pressable>
            </View>
          ))
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E1812' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 24, paddingBottom: 48 },
  heading: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#a3a3a3', fontSize: 13, marginTop: 4, marginBottom: 16 },
  emptyBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  emptyBody: { color: '#a3a3a3', fontSize: 14, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  name: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#a3a3a3', fontSize: 12, marginTop: 2 },
  inviteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteText: { color: '#000000', fontWeight: '600', fontSize: 13 },
  empty: { color: '#a3a3a3', textAlign: 'center' },
  error: { color: '#f87171', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
