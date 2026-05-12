import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { ADMIN_EMAIL, fetchWaitlist, type WaitlistEntry } from '@/lib/admin';

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
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: `Waitlist (${entries.length})`,
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {error && <Text style={styles.error}>{error}</Text>}
        {entries.length === 0 && !error ? (
          <Text style={styles.empty}>Ninguém na lista ainda.</Text>
        ) : (
          entries.map((e) => (
            <View key={e.id} style={styles.row}>
              <Text style={styles.email}>{e.email}</Text>
              <Text style={styles.meta}>
                {e.city ?? '—'} · {e.source ?? '—'} ·{' '}
                {new Date(e.created_at).toLocaleDateString('pt-PT')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  empty: {
    color: '#737373',
    fontSize: 13,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  row: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  email: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#a3a3a3', fontSize: 12, marginTop: 4 },
  error: { color: '#f87171', textAlign: 'center', marginBottom: 16, fontSize: 13 },
});
