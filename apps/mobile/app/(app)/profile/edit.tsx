import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchProfile, updateProfile } from '@/lib/profile';

export default function EditProfileScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const p = await fetchProfile(session.user.id);
      if (cancelled || !p) {
        setLoading(false);
        return;
      }
      setName(p.name);
      setCity(p.city);
      setPhone(p.phone ?? '');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSubmit() {
    setError(null);
    if (!session) return;
    if (!name.trim()) {
      setError('Diz-nos o teu nome.');
      return;
    }
    if (!city.trim()) {
      setError('Cidade obrigatória.');
      return;
    }
    setSubmitting(true);
    const r = await updateProfile(session.user.id, {
      name: name.trim(),
      city: city.trim(),
      phone: phone.trim() || null,
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.back();
  }

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
          headerTitle: 'Editar perfil',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!submitting}
          />

          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!submitting}
          />

          <Text style={styles.label}>Telemóvel (opcional)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!submitting}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submit, submitting && styles.submitDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Guardar</Text>
            )}
          </Pressable>

          <Text style={styles.hint}>
            Para editar desportos e nível, contacta o suporte por enquanto.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  label: {
    color: '#a3a3a3',
    fontSize: 13,
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  submit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  hint: {
    color: '#737373',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
});
