import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { MatchHistoryRow } from '@/components/MatchHistoryRow';
import { fetchProfile, type Profile } from '@/lib/profile';
import {
  fetchDetailedMatchHistory,
  type DetailedMatchHistoryEntry,
} from '@/lib/history';
import { colors } from '@/theme';

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}`;
}

export default function UserMatchesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<DetailedMatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [p, r] = await Promise.all([
      fetchProfile(id),
      fetchDetailedMatchHistory(id, 50),
    ]);
    setProfile(p);
    setRows(r);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Últimos jogos',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(300).springify()}>
              <Eyebrow>{profile?.name ?? ''}</Eyebrow>
              <Heading level={2} style={{ marginTop: 4 }}>
                {`${rows.length} ${rows.length === 1 ? 'jogo' : 'jogos'}`}
              </Heading>
            </Animated.View>

            {rows.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Sem jogos para mostrar</Text>
                <Text style={styles.emptyBody}>
                  {profile?.is_private
                    ? 'Este perfil é privado. Se forem amigos, vê os jogos depois.'
                    : 'Ainda não há jogos validados.'}
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 18 }}>
                {rows.map((m, i) => (
                  <Animated.View
                    key={m.match_id}
                    entering={FadeInDown.delay(60 + i * 20).springify()}
                  >
                    <MatchHistoryRow
                      m={m}
                      onPress={() => router.push(`/(app)/matches/${m.match_id}`)}
                    />
                  </Animated.View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  date: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    width: 38,
    letterSpacing: 0.2,
  },
  teamsCol: { flex: 1, minWidth: 0 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  teamNameBold: {
    color: colors.text,
    fontWeight: '800',
  },
  statsCol: { minWidth: 40, alignItems: 'flex-end' },
  statsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statBadgeMvp: {
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  statBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  peladinhaDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  scoreCol: { minWidth: 18, alignItems: 'flex-end' },
  score: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  scoreBold: {
    color: colors.text,
    fontWeight: '900',
  },
  resultChip: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    color: '#0E1812',
    fontSize: 12,
    fontWeight: '900',
  },
  empty: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
});
