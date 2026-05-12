import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchTeamById, updateTeam } from '@/lib/teams';
import { pickImage, uploadTeamLogo } from '@/lib/photos';
import { Avatar } from '@/components/Avatar';
import { supabase } from '@/lib/supabase';

export default function EditTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCaptain, setIsCaptain] = useState(false);

  useEffect(() => {
    if (!id || !session) return;
    let cancelled = false;
    (async () => {
      const t = await fetchTeamById(id);
      if (cancelled || !t) {
        setLoading(false);
        return;
      }
      setName(t.name);
      setCity(t.city);
      setPhotoUrl(t.photo_url ?? null);
      setIsCaptain(t.captain_id === session.user.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, session]);

  async function handlePickLogo() {
    if (!id) return;
    setError(null);
    const image = await pickImage();
    if (!image) return;
    setUploadingPhoto(true);
    const up = await uploadTeamLogo(id, image);
    if (!up.ok) {
      setUploadingPhoto(false);
      setError(up.message);
      return;
    }
    const { error: dbErr } = await supabase
      .from('teams')
      .update({ photo_url: up.publicUrl })
      .eq('id', id);
    setUploadingPhoto(false);
    if (dbErr) {
      setError(dbErr.message ?? 'Falhou guardar escudo.');
      return;
    }
    setPhotoUrl(up.publicUrl);
  }

  async function handleSubmit() {
    setError(null);
    if (!id) return;
    if (!name.trim()) {
      setError('Diz o nome.');
      return;
    }
    if (!city.trim()) {
      setError('Cidade obrigatória.');
      return;
    }
    setSubmitting(true);
    const r = await updateTeam(id, { name: name.trim(), city: city.trim() });
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

  if (!isCaptain) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: 'Editar equipa',
            headerStyle: { backgroundColor: '#0a0a0a' },
            headerTintColor: '#ffffff',
          }}
        />
        <View style={styles.center}>
          <Text style={styles.deny}>Só o capitão pode editar a equipa.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Editar equipa',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.avatarBlock}>
            <Avatar url={photoUrl} name={name} size={96} />
            <Pressable
              onPress={handlePickLogo}
              disabled={uploadingPhoto}
              style={[
                styles.changePhotoBtn,
                uploadingPhoto && styles.submitDisabled,
              ]}
            >
              {uploadingPhoto ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.changePhotoText}>
                  {photoUrl ? 'Mudar escudo' : 'Adicionar escudo'}
                </Text>
              )}
            </Pressable>
          </View>

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
            Para mudar de desporto ou eliminar a equipa, contacta o suporte
            por enquanto.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
  deny: { color: '#a3a3a3', textAlign: 'center' },
  avatarBlock: { alignItems: 'center', gap: 12, marginTop: 8 },
  changePhotoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  changePhotoText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
});
