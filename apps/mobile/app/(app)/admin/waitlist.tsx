import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { ADMIN_EMAIL, fetchWaitlist, type WaitlistEntry } from '@/lib/admin';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { colors } from '@/theme';

export default function WaitlistAdminScreen() {
  const { session } = useAuth();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    if (session.user.email !== ADMIN_EMAIL) {
      setError('Sem acesso.');
      setLoading(false);
      return;
    }
    const data = await fetchWaitlist();
    setEntries(data);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: `Waitlist · ${entries.length}`,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {error && <Text style={styles.error}>{error}</Text>}
        {entries.length === 0 && !error ? (
          <Card>
            <Text style={styles.empty}>Ninguém na lista ainda.</Text>
          </Card>
        ) : (
          entries.map((e, i) => (
            <Animated.View
              key={e.id}
              entering={FadeInDown.delay(i * 30).springify()}
            >
              <Card style={{ marginTop: 8 }}>
                <Text style={styles.email}>{e.email}</Text>
                <Text style={styles.meta}>
                  {`${e.city ?? '—'} · ${e.source ?? '—'} · ${new Date(e.created_at).toLocaleDateString('pt-PT')}`}
                </Text>
              </Card>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  empty: { color: colors.textDim, fontSize: 13 },
  email: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 13,
  },
});
