import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/notifications';
import { Screen } from '@/components/Screen';
import { Heading } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme';

function relTime(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.floor((now - d) / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return new Date(iso).toLocaleDateString('pt-PT');
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const data = await fetchMyNotifications(session.user.id);
    setItems(data);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    if (!session) return;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load, session]);

  const hasUnread = items.some((n) => !n.read_at);

  async function onTap(n: AppNotification) {
    if (!n.read_at) {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((it) =>
          it.id === n.id
            ? { ...it, read_at: new Date().toISOString() }
            : it,
        ),
      );
    }
    const matchId = (n.payload as any)?.match_id as string | undefined;
    if (matchId) router.push(`/(app)/matches/${matchId}`);
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Notificações',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <Heading level={1}>Notificações</Heading>
        </Animated.View>

        {hasUnread && (
          <View style={{ marginTop: 12 }}>
            <Button
              label="Marcar todas como lidas"
              variant="ghost"
              size="sm"
              onPress={async () => {
                if (!session) return;
                await markAllNotificationsRead(session.user.id);
                setItems((prev) =>
                  prev.map((n) =>
                    n.read_at
                      ? n
                      : { ...n, read_at: new Date().toISOString() },
                  ),
                );
              }}
            />
          </View>
        )}

        {loading ? (
          <View style={{ gap: 8, marginTop: 16 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={70} radius={16} />
            ))}
          </View>
        ) : items.length === 0 ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.empty}>
              Sem notificações. Aparecem aqui quando alguém te desafia,
              aceita um jogo, ou te avalia.
            </Text>
          </Card>
        ) : (
          items.map((n, i) => (
            <Animated.View
              key={n.id}
              entering={FadeInDown.delay(60 + i * 25).springify()}
            >
              <Card
                onPress={() => onTap(n)}
                style={[
                  { marginTop: 8 },
                  !n.read_at && styles.unread,
                ]}
              >
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{n.title}</Text>
                    {n.body && <Text style={styles.body}>{n.body}</Text>}
                  </View>
                  <View style={styles.right}>
                    {!n.read_at && <View style={styles.dot} />}
                    <Text style={styles.time}>{relTime(n.sent_at)}</Text>
                  </View>
                </View>
              </Card>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  empty: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  unread: {
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  right: { alignItems: 'flex-end', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  time: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
});
