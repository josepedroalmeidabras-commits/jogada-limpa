import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';
import { fetchMyTeams, type TeamWithSport } from '@/lib/teams';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<TeamWithSport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    if (!p) {
      router.replace('/(app)/onboarding');
      return;
    }
    setProfile(p);
    const myTeams = await fetchMyTeams(session.user.id);
    setTeams(myTeams);
    setLoading(false);
  }, [session, router]);

  useEffect(() => {
    load();
  }, [load]);

  // re-fetch when returning to this screen (e.g. after creating a team)
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.hello}>Olá, {profile?.name}</Text>
          <Text style={styles.city}>{profile?.city}</Text>
        </View>

        <Text style={styles.section}>As tuas equipas</Text>

        {teams.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Ainda não tens equipas</Text>
            <Text style={styles.emptyBody}>
              Cria a tua equipa e convida jogadores, ou entra noutra com um
              código de convite.
            </Text>
          </View>
        ) : (
          teams.map((t) => (
            <Pressable
              key={t.id}
              style={styles.card}
              onPress={() => router.push(`/(app)/teams/${t.id}`)}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardName}>{t.name}</Text>
                <Text style={styles.cardMeta}>
                  {t.sport?.name} · {t.city}
                </Text>
              </View>
              <Text style={styles.cardArrow}>›</Text>
            </Pressable>
          ))
        )}

        <View style={styles.actions}>
          <Pressable
            style={styles.primary}
            onPress={() => router.push('/(app)/teams/new')}
          >
            <Text style={styles.primaryText}>Criar equipa</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push('/(app)/teams/join')}
          >
            <Text style={styles.secondaryText}>Entrar com código</Text>
          </Pressable>
        </View>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sair</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { marginBottom: 32, marginTop: 8 },
  hello: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  city: { color: '#a3a3a3', fontSize: 14, marginTop: 4 },
  section: {
    color: '#a3a3a3',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  empty: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emptyTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  emptyBody: { color: '#a3a3a3', fontSize: 14, marginTop: 8, lineHeight: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  cardLeft: { flex: 1 },
  cardName: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  cardMeta: { color: '#a3a3a3', fontSize: 13, marginTop: 2 },
  cardArrow: { color: '#a3a3a3', fontSize: 24, marginLeft: 12 },
  actions: { marginTop: 16, gap: 8 },
  primary: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  secondary: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  signOut: {
    marginTop: 40,
    paddingVertical: 12,
    alignItems: 'center',
  },
  signOutText: { color: '#737373', fontSize: 13 },
});
