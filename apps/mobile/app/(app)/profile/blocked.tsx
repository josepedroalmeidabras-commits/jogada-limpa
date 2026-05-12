import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect } from 'expo-router';
import {
  fetchBlockedUsers,
  unblockUser,
  type BlockedUser,
} from '@/lib/moderation';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Heading, Eyebrow } from '@/components/Heading';
import { colors } from '@/theme';

export default function BlockedUsersScreen() {
  const [list, setList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchBlockedUsers();
    setList(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function handleUnblock(b: BlockedUser) {
    const name = b.profile?.name ?? 'este jogador';
    Alert.alert('Desbloquear?', `${name} voltará a aparecer no mercado.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear',
        onPress: async () => {
          setBusy(b.blocked_id);
          const r = await unblockUser(b.blocked_id);
          setBusy(null);
          if (!r.ok) {
            Alert.alert('Erro', r.message ?? 'Falhou.');
            return;
          }
          setList((prev) => prev.filter((x) => x.blocked_id !== b.blocked_id));
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Bloqueados',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : list.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(300).springify()}>
            <Eyebrow>Bloqueados</Eyebrow>
            <Heading level={2} style={{ marginTop: 4 }}>
              Nenhum
            </Heading>
            <Text style={styles.hint}>
              Os jogadores que bloqueares aparecem aqui. Não te vêem no
              mercado e tu não os vês.
            </Text>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(300).springify()}>
              <Eyebrow>{`Bloqueados · ${list.length}`}</Eyebrow>
              <Heading level={2} style={{ marginTop: 4 }}>
                Jogadores bloqueados
              </Heading>
            </Animated.View>
            {list.map((b, i) => (
              <Animated.View
                key={b.blocked_id}
                entering={FadeInDown.delay(80 + i * 30).springify()}
              >
                <Card style={{ marginTop: 12 }}>
                  <View style={styles.row}>
                    <Avatar
                      url={b.profile?.photo_url ?? null}
                      name={b.profile?.name ?? '?'}
                      size={44}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {b.profile?.name ?? 'Conta apagada'}
                      </Text>
                      {b.profile?.city && (
                        <Text style={styles.city}>{b.profile.city}</Text>
                      )}
                    </View>
                    <Button
                      label="Desbloquear"
                      variant="secondary"
                      size="sm"
                      loading={busy === b.blocked_id}
                      onPress={() => handleUnblock(b)}
                    />
                  </View>
                </Card>
              </Animated.View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: { paddingVertical: 48, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  city: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 12,
    lineHeight: 19,
  },
});
