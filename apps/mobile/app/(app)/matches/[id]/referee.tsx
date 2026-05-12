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
import {
  searchProfiles,
  type SearchedUser,
} from '@/lib/user-search';
import { setMatchReferee } from '@/lib/referee';
import { fetchMatchById, type MatchSummary } from '@/lib/matches';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Eyebrow, Heading } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export default function PickRefereeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const m = await fetchMatchById(id);
      if (cancelled) return;
      setMatch(m);
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

  const pickReferee = useCallback(
    async (refId: string | null) => {
      if (!id) return;
      setPicking(refId ?? 'clear');
      const r = await setMatchReferee(id, refId);
      setPicking(null);
      if (!r.ok) {
        Alert.alert('Erro', r.message);
        return;
      }
      router.back();
    },
    [id, router],
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Árbitro',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow>Árbitro opcional</Eyebrow>
        <Heading level={2} style={{ marginTop: 4 }}>
          Procurar quem vai apitar
        </Heading>
        <Text style={styles.hint}>
          Qualquer pessoa pode ser árbitro — um colega convidado, alguém de
          fora do clube. Depois do jogo, quem jogou pode avaliar o árbitro.
        </Text>

        <View style={[styles.searchRow, { marginTop: 16 }]}>
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
                <Text style={styles.muted}>
                  Sem resultados para "{query.trim()}".
                </Text>
              </Card>
            ) : (
              results.map((u) => (
                <Card key={u.id} style={{ marginTop: 8 }}>
                  <View style={styles.row}>
                    <Avatar
                      url={u.photo_url}
                      name={u.name}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{u.name}</Text>
                      <Text style={styles.city}>{u.city}</Text>
                    </View>
                    <Button
                      label="Escolher"
                      size="sm"
                      loading={picking === u.id}
                      onPress={() => pickReferee(u.id)}
                    />
                  </View>
                </Card>
              ))
            )}
          </View>
        )}

        {match?.referee_id && (
          <View style={{ marginTop: 32 }}>
            <Button
              label="Remover árbitro"
              variant="ghost"
              loading={picking === 'clear'}
              onPress={() => pickReferee(null)}
              full
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 19 },
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
  name: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  city: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
