import { useEffect, useState } from 'react';
import {
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
import { searchAll, type UniversalSearchResult } from '@/lib/user-search';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { colors } from '@/theme';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UniversalSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchAll(q);
      setResults(r);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const profiles = results.filter((r) => r.kind === 'profile');
  const teams = results.filter((r) => r.kind === 'team');

  function open(result: UniversalSearchResult) {
    if (result.kind === 'profile') {
      router.push(`/(app)/users/${result.id}`);
    } else {
      router.push(`/(app)/teams/${result.id}`);
    }
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Pesquisa',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <View style={styles.outer}>
        <View style={styles.searchRow}>
          <Ionicons
            name="search"
            size={18}
            color={colors.textMuted}
            style={{ marginLeft: 14 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Procurar jogadores ou equipas"
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            autoFocus
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

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {query.trim().length < 2 ? (
            <View style={styles.center}>
              <Text style={styles.muted}>
                Procura por nome ou cidade. Mínimo 2 letras.
              </Text>
            </View>
          ) : searching ? null : results.length === 0 ? (
            <View style={styles.center}>
              <Heading level={3}>Sem resultados</Heading>
              <Text style={styles.muted}>
                {`Nada encontrado para "${query.trim()}".`}
              </Text>
            </View>
          ) : (
            <>
              {profiles.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Eyebrow>{`Jogadores · ${profiles.length}`}</Eyebrow>
                  {profiles.map((r, i) => (
                    <Animated.View
                      key={`p-${r.id}`}
                      entering={FadeInDown.delay(20 + i * 20).springify()}
                    >
                      <Card onPress={() => open(r)} style={{ marginTop: 8 }}>
                        <View style={styles.row}>
                          <Avatar
                            url={r.photo_url}
                            name={r.name}
                            size={40}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{r.name}</Text>
                            <Text style={styles.meta} numberOfLines={1}>
                              {r.city}
                              {r.meta && r.meta.length > 0
                                ? ` · ${r.meta}`
                                : ''}
                            </Text>
                          </View>
                          <Text style={styles.arrow}>›</Text>
                        </View>
                      </Card>
                    </Animated.View>
                  ))}
                </View>
              )}

              {teams.length > 0 && (
                <View style={{ marginTop: 24 }}>
                  <Eyebrow>{`Equipas · ${teams.length}`}</Eyebrow>
                  {teams.map((r, i) => (
                    <Animated.View
                      key={`t-${r.id}`}
                      entering={FadeInDown.delay(20 + i * 20).springify()}
                    >
                      <Card onPress={() => open(r)} style={{ marginTop: 8 }}>
                        <View style={styles.row}>
                          <Avatar
                            url={r.photo_url}
                            name={r.name}
                            size={40}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{r.name}</Text>
                            <Text style={styles.meta} numberOfLines={1}>
                              {r.city}
                              {r.meta && r.meta.length > 0
                                ? ` · ${r.meta}`
                                : ''}
                            </Text>
                          </View>
                          <Text style={styles.arrow}>›</Text>
                        </View>
                      </Card>
                    </Animated.View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, padding: 24, gap: 12 },
  center: { paddingVertical: 48, alignItems: 'center', gap: 8 },
  muted: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
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
  arrow: { color: colors.textDim, fontSize: 22, fontWeight: '300' },
});
