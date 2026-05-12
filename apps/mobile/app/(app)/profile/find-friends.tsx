import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchSuggestedFriends,
  searchProfiles,
  type SearchedUser,
  type SuggestedFriend,
} from '@/lib/user-search';
import {
  cancelFriendRequest,
  fetchFriendshipStatus,
  sendFriendRequest,
  type FriendshipStatus,
} from '@/lib/friends';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Eyebrow, Heading } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

type Row = {
  id: string;
  name: string;
  photo_url: string | null;
  city: string;
  meta: string;
};

export default function FindFriendsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedFriend[]>([]);
  const [statuses, setStatuses] = useState<Record<string, FriendshipStatus>>({});
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Load suggestions on mount
  useEffect(() => {
    (async () => {
      const s = await fetchSuggestedFriends();
      setSuggestions(s);
      await refreshStatuses(s.map((u) => u.id));
    })();
  }, []);

  // Debounced search
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
      await refreshStatuses(r.map((u) => u.id));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const refreshStatuses = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => !(id in statuses));
    if (missing.length === 0) return;
    const fetched = await Promise.all(
      missing.map(async (id) => [id, await fetchFriendshipStatus(id)] as const),
    );
    setStatuses((prev) => ({ ...prev, ...Object.fromEntries(fetched) }));
  }, [statuses]);

  async function handleAdd(id: string) {
    setBusy(id);
    const r = await sendFriendRequest(id);
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    setStatuses((prev) => ({ ...prev, [id]: 'pending_sent' }));
  }

  async function handleCancel(id: string) {
    setBusy(id);
    const r = await cancelFriendRequest(id);
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    setStatuses((prev) => ({ ...prev, [id]: 'none' }));
  }

  const isSearching = query.trim().length >= 2;

  const searchRows = useMemo<Row[]>(
    () =>
      results.map((u) => ({
        id: u.id,
        name: u.name,
        photo_url: u.photo_url,
        city: u.city,
        meta: u.city,
      })),
    [results],
  );

  const suggestionRows = useMemo<Row[]>(
    () =>
      suggestions.map((u) => ({
        id: u.id,
        name: u.name,
        photo_url: u.photo_url,
        city: u.city,
        meta: `${u.matches_shared} jogo${u.matches_shared === 1 ? '' : 's'} em comum`,
      })),
    [suggestions],
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Adicionar amigos',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <View style={styles.searchRow}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textMuted}
              style={{ marginLeft: 14 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Procurar por nome ou cidade"
              placeholderTextColor={colors.textFaint}
              value={query}
              onChangeText={setQuery}
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
        </Animated.View>

        {isSearching ? (
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
              searchRows.map((r, i) => (
                <Animated.View
                  key={r.id}
                  entering={FadeInDown.delay(40 + i * 20).springify()}
                >
                  <UserRow
                    row={r}
                    status={statuses[r.id] ?? 'none'}
                    busy={busy === r.id}
                    onOpen={() => router.push(`/(app)/users/${r.id}`)}
                    onAdd={() => handleAdd(r.id)}
                    onCancel={() => handleCancel(r.id)}
                  />
                </Animated.View>
              ))
            )}
          </View>
        ) : (
          <View style={{ marginTop: 16 }}>
            <Eyebrow>Sugestões</Eyebrow>
            {suggestions.length === 0 ? (
              <Card style={{ marginTop: 8 }}>
                <Heading level={3}>Sem sugestões ainda</Heading>
                <Text style={styles.muted}>
                  Quando jogares com mais pessoas, vamos sugerir aqui. Para já,
                  procura por nome.
                </Text>
              </Card>
            ) : (
              suggestionRows.map((r, i) => (
                <Animated.View
                  key={r.id}
                  entering={FadeInDown.delay(40 + i * 20).springify()}
                >
                  <UserRow
                    row={r}
                    status={statuses[r.id] ?? 'none'}
                    busy={busy === r.id}
                    onOpen={() => router.push(`/(app)/users/${r.id}`)}
                    onAdd={() => handleAdd(r.id)}
                    onCancel={() => handleCancel(r.id)}
                  />
                </Animated.View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function UserRow({
  row,
  status,
  busy,
  onOpen,
  onAdd,
  onCancel,
}: {
  row: Row;
  status: FriendshipStatus;
  busy: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  return (
    <Card onPress={onOpen} style={{ marginTop: 8 }}>
      <View style={styles.row}>
        <Avatar url={row.photo_url} name={row.name} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.meta}>{row.meta}</Text>
        </View>
        {status === 'friends' ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>✓ Amigos</Text>
          </View>
        ) : status === 'pending_sent' ? (
          <Button
            label="Cancelar"
            variant="secondary"
            size="sm"
            loading={busy}
            onPress={onCancel}
          />
        ) : status === 'pending_received' ? (
          <Button
            label="Responder"
            variant="secondary"
            size="sm"
            onPress={onOpen}
          />
        ) : (
          <Button
            label="+ Adicionar"
            size="sm"
            loading={busy}
            onPress={onAdd}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
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
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  pillText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
});
