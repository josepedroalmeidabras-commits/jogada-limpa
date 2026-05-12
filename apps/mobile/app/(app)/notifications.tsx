import { useCallback, useMemo, useState } from 'react';
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
import { Heading, Eyebrow } from '@/components/Heading';
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

function iconForType(type: string): string {
  if (type.startsWith('match_invite') || type.startsWith('match_proposed')) return '⚔️';
  if (type.startsWith('match_confirmed')) return '✅';
  if (type.startsWith('match_cancelled')) return '❌';
  if (type.startsWith('match_rescheduled')) return '📅';
  if (type.startsWith('result')) return '⚽';
  if (type.startsWith('review')) return '⭐';
  if (type.startsWith('peladinha')) return '⚡';
  if (type.startsWith('team_announcement')) return '📌';
  if (type.startsWith('friend_request')) return '👋';
  if (type.startsWith('friend_accepted')) return '🤝';
  if (type.startsWith('substitute')) return '🆘';
  if (type.startsWith('open_match')) return '🔔';
  if (type.startsWith('match_chat') || type.startsWith('team_chat')) return '💬';
  return '🔔';
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
    return 'HOJE';
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  )
    return 'ONTEM';
  const diff = Math.floor(
    (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 7) return 'ESTA SEMANA';
  if (diff < 30) return 'ESTE MÊS';
  return 'MAIS ANTIGO';
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
    const payload = n.payload as any;
    const matchId = payload?.match_id as string | undefined;
    const teamId = payload?.team_id as string | undefined;
    const fromId = (payload?.from_id ?? payload?.friend_id) as string | undefined;
    if (matchId) {
      router.push(`/(app)/matches/${matchId}`);
    } else if (teamId) {
      router.push(`/(app)/teams/${teamId}`);
    } else if (fromId) {
      router.push(`/(app)/users/${fromId}`);
    }
  }

  // Group items by day bucket while preserving order
  const grouped = useMemo(() => {
    const result: Array<{ key: string; items: AppNotification[] }> = [];
    let currentKey: string | null = null;
    for (const n of items) {
      const k = dayKey(n.sent_at);
      if (k !== currentKey) {
        result.push({ key: k, items: [] });
        currentKey = k;
      }
      result[result.length - 1]!.items.push(n);
    }
    return result;
  }, [items]);

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
          grouped.map((group, gi) => (
            <View key={`g-${gi}`} style={{ marginTop: gi === 0 ? 16 : 24 }}>
              <Eyebrow>{group.key}</Eyebrow>
              {group.items.map((n, i) => (
                <Animated.View
                  key={n.id}
                  entering={FadeInDown.delay(20 + i * 20).springify()}
                >
                  <Card
                    onPress={() => onTap(n)}
                    style={[
                      { marginTop: 8 },
                      !n.read_at && styles.unread,
                    ]}
                  >
                    <View style={styles.row}>
                      <Text style={styles.icon}>{iconForType(n.type)}</Text>
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
              ))}
            </View>
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
  icon: { fontSize: 22, marginTop: 2 },
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
