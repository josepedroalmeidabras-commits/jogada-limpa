import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/auth';
import {
  fetchCoach,
  fetchTeamById,
  setTeamCoach,
  type CoachProfile,
  type TeamWithSport,
} from '@/lib/teams';
import { searchProfiles, type SearchedUser } from '@/lib/user-search';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export default function CoachPickerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const t = await fetchTeamById(id);
      if (cancelled) return;
      setTeam(t);
      if (t?.coach_id) {
        const c = await fetchCoach(t.coach_id);
        if (!cancelled) setCoach(c);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchProfiles(q);
      setResults(r);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const pick = useCallback(
    async (coachId: string | null) => {
      if (!id) return;
      setBusy(coachId ?? 'clear');
      const r = await setTeamCoach(id, coachId);
      setBusy(null);
      if (!r.ok) {
        Alert.alert('Erro', r.message);
        return;
      }
      router.back();
    },
    [id, router],
  );

  if (loading) return <Screen>{null}</Screen>;
  const isCaptain = team?.captain_id === session?.user.id;
  if (!team || !isCaptain) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>
            Só o capitão pode definir o treinador.
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
          headerTitle: 'Treinador',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow>{team.name}</Eyebrow>
        <Heading level={2} style={{ marginTop: 4 }}>
          Definir treinador
        </Heading>
        <Text style={styles.hint}>
          Opcional. Pode ser alguém de dentro ou de fora da equipa.
        </Text>

        {coach && (
          <View style={{ marginTop: 16 }}>
            <Eyebrow>Treinador actual</Eyebrow>
            <Card style={{ marginTop: 8 }}>
              <View style={styles.row}>
                <Avatar url={coach.photo_url} name={coach.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{coach.name}</Text>
                  <Text style={styles.city}>{coach.city}</Text>
                </View>
                <Button
                  label="Remover"
                  variant="ghost"
                  size="sm"
                  loading={busy === 'clear'}
                  onPress={() => pick(null)}
                />
              </View>
            </Card>
          </View>
        )}

        <View style={[styles.searchRow, { marginTop: 24 }]}>
          <Ionicons
            name="search"
            size={18}
            color={colors.textMuted}
            style={{ marginLeft: 14 }}
          />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Procurar por nome ou cidade"
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery('')}
              style={{ paddingHorizontal: 14 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.textDim} />
            </Pressable>
          )}
        </View>

        {query.trim().length >= 2 && (
          <View style={{ marginTop: 16 }}>
            <Eyebrow>
              {searching ? 'A procurar…' : `Resultados · ${results.length}`}
            </Eyebrow>
            {!searching && results.length === 0 ? (
              <Card style={{ marginTop: 8 }}>
                <Text style={styles.muted}>Sem resultados.</Text>
              </Card>
            ) : (
              results.map((u) => (
                <Card key={u.id} style={{ marginTop: 8 }}>
                  <View style={styles.row}>
                    <Avatar url={u.photo_url} name={u.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{u.name}</Text>
                      <Text style={styles.city}>{u.city}</Text>
                    </View>
                    <Button
                      label="Definir"
                      size="sm"
                      loading={busy === u.id}
                      onPress={() => pick(u.id)}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 19 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 15,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  city: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
