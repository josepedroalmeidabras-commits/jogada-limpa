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
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchFriendsLeaderboard,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  removeFriend,
  cancelFriendRequest,
  type FriendLeaderboardEntry,
  type FriendProfile,
  type PendingRequest,
} from '@/lib/friends';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Eyebrow, Heading } from '@/components/Heading';
import { colors } from '@/theme';

export default function FriendsScreen() {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [outgoing, setOutgoing] = useState<PendingRequest[]>([]);
  const [board, setBoard] = useState<FriendLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, i, o, b] = await Promise.all([
      fetchFriends(),
      fetchIncomingRequests(),
      fetchOutgoingRequests(),
      fetchFriendsLeaderboard(),
    ]);
    setFriends(f);
    setIncoming(i);
    setOutgoing(o);
    setBoard(b);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleAccept(id: string) {
    setBusy(id);
    const r = await acceptFriendRequest(id);
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    await load();
  }

  async function handleDecline(id: string) {
    setBusy(id);
    const r = await declineFriendRequest(id);
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    setIncoming((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleCancel(id: string) {
    setBusy(id);
    const r = await cancelFriendRequest(id);
    setBusy(null);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    setOutgoing((prev) => prev.filter((p) => p.id !== id));
  }

  function handleRemove(friend: FriendProfile) {
    Alert.alert('Remover amigo?', `${friend.name} deixa de ser teu amigo.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setBusy(friend.id);
          const r = await removeFriend(friend.id);
          setBusy(null);
          if (!r.ok) {
            Alert.alert('Erro', r.message);
            return;
          }
          setFriends((prev) => prev.filter((f) => f.id !== friend.id));
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Amigos',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 16 }}>
          <Button
            label="+ Adicionar amigos"
            variant="secondary"
            full
            onPress={() => router.push('/(app)/profile/find-friends')}
          />
        </View>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : (
          <>
            {board.length >= 2 && (
              <Animated.View
                entering={FadeInDown.duration(300).springify()}
                style={{ marginBottom: 24 }}
              >
                <Eyebrow>Ranking entre amigos</Eyebrow>
                <Card style={{ marginTop: 8 }}>
                  {board.slice(0, 8).map((b, i) => {
                    const medal =
                      i === 0
                        ? '🥇'
                        : i === 1
                          ? '🥈'
                          : i === 2
                            ? '🥉'
                            : null;
                    return (
                      <View
                        key={b.user_id}
                        style={[
                          styles.boardRow,
                          i > 0 && styles.boardRowBorder,
                          b.is_self && styles.boardRowSelf,
                        ]}
                      >
                        {medal ? (
                          <Text style={styles.boardMedal}>{medal}</Text>
                        ) : (
                          <Text style={styles.boardRank}>{i + 1}</Text>
                        )}
                        <Avatar
                          url={b.photo_url}
                          name={b.name}
                          size={32}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.boardName,
                              b.is_self && { color: colors.brand },
                            ]}
                            numberOfLines={1}
                          >
                            {b.name}
                            {b.is_self && '  · tu'}
                          </Text>
                          <Text style={styles.boardMeta}>
                            {`${b.matches} jogo${b.matches === 1 ? '' : 's'}`}
                          </Text>
                        </View>
                        <Text style={styles.boardPct}>
                          {b.matches > 0 ? `${Math.round(b.win_pct)}%` : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              </Animated.View>
            )}

            {incoming.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300).springify()}>
                <Eyebrow>{`Pedidos recebidos · ${incoming.length}`}</Eyebrow>
                {incoming.map((r, i) => (
                  <Animated.View
                    key={r.id}
                    entering={FadeInDown.delay(40 + i * 30).springify()}
                  >
                    <Card style={{ marginTop: 8 }}>
                      <View style={styles.row}>
                        <Avatar
                          url={r.photo_url}
                          name={r.name}
                          size={44}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{r.name}</Text>
                          <Text style={styles.city}>{r.city}</Text>
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <Button
                          label="Aceitar"
                          size="sm"
                          loading={busy === r.id}
                          onPress={() => handleAccept(r.id)}
                        />
                        <Button
                          label="Recusar"
                          variant="secondary"
                          size="sm"
                          onPress={() => handleDecline(r.id)}
                        />
                      </View>
                    </Card>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            {outgoing.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(80).springify()}
                style={{ marginTop: incoming.length > 0 ? 24 : 0 }}
              >
                <Eyebrow>{`Enviados · ${outgoing.length}`}</Eyebrow>
                {outgoing.map((r, i) => (
                  <Animated.View
                    key={r.id}
                    entering={FadeInDown.delay(120 + i * 30).springify()}
                  >
                    <Card
                      onPress={() => router.push(`/(app)/users/${r.id}`)}
                      style={{ marginTop: 8 }}
                    >
                      <View style={styles.row}>
                        <Avatar
                          url={r.photo_url}
                          name={r.name}
                          size={44}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{r.name}</Text>
                          <Text style={styles.city}>
                            {`A aguardar resposta`}
                          </Text>
                        </View>
                        <Button
                          label="Cancelar"
                          variant="ghost"
                          size="sm"
                          loading={busy === r.id}
                          onPress={() => handleCancel(r.id)}
                        />
                      </View>
                    </Card>
                  </Animated.View>
                ))}
              </Animated.View>
            )}

            <Animated.View
              entering={FadeInDown.delay(160).springify()}
              style={{
                marginTop:
                  incoming.length > 0 || outgoing.length > 0 ? 24 : 0,
              }}
            >
              <Eyebrow>{`Amigos · ${friends.length}`}</Eyebrow>
              {friends.length === 0 ? (
                <Card style={{ marginTop: 8 }}>
                  <Heading level={3}>Ainda sem amigos</Heading>
                  <Text style={styles.hint}>
                    Quando um colega aceitar o teu pedido, aparece aqui. Os
                    amigos podem votar nos teus atributos.
                  </Text>
                </Card>
              ) : (
                friends.map((f, i) => (
                  <Animated.View
                    key={f.id}
                    entering={FadeInDown.delay(200 + i * 25).springify()}
                  >
                    <Card
                      onPress={() => router.push(`/(app)/users/${f.id}`)}
                      onLongPress={() => handleRemove(f)}
                      style={{ marginTop: 8 }}
                    >
                      <View style={styles.row}>
                        <Avatar url={f.photo_url} name={f.name} size={44} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{f.name}</Text>
                          <Text style={styles.city}>{f.city}</Text>
                        </View>
                      </View>
                    </Card>
                  </Animated.View>
                ))
              )}
              {friends.length > 0 && (
                <Text style={styles.tip}>
                  Mantém pressionado para remover um amigo.
                </Text>
              )}
            </Animated.View>
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
  name: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  city: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 19,
  },
  tip: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  boardRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  boardRowSelf: {
    backgroundColor: colors.brandSoft,
  },
  boardMedal: { fontSize: 18, width: 26, textAlign: 'center' },
  boardRank: {
    width: 26,
    textAlign: 'center',
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '800',
  },
  boardName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  boardMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  boardPct: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
    minWidth: 44,
    textAlign: 'right',
  },
});
