import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, type Profile } from '@/lib/profile';

export default function HomeScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const p = await fetchProfile(session.user.id);
      if (cancelled) return;
      if (!p) {
        router.replace('/(app)/onboarding');
        return;
      }
      setProfile(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, router]);

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
      <View style={styles.container}>
        <Text style={styles.title}>Olá, {profile?.name} 👋</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
        <Text style={styles.city}>{profile?.city}</Text>

        <Text style={styles.note}>
          Perfil criado. Em breve: equipas, marcação de jogos e reviews.
        </Text>

        <Pressable style={styles.button} onPress={signOut}>
          <Text style={styles.buttonText}>Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  email: {
    color: '#a3a3a3',
    fontSize: 14,
    textAlign: 'center',
  },
  city: {
    color: '#737373',
    fontSize: 14,
    textAlign: 'center',
  },
  note: {
    color: '#737373',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
