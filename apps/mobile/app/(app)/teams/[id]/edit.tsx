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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  deactivateTeam,
  fetchTeamById,
  fetchTeamMembers,
  setTeamAnnouncement,
  transferCaptaincy,
  updateTeam,
  type TeamMember,
} from '@/lib/teams';
import { pickImage, uploadTeamLogo } from '@/lib/photos';
import { Avatar } from '@/components/Avatar';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export default function EditTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [annBusy, setAnnBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCaptain, setIsCaptain] = useState(false);

  useEffect(() => {
    if (!id || !session) return;
    let cancelled = false;
    (async () => {
      const [t, m] = await Promise.all([
        fetchTeamById(id),
        fetchTeamMembers(id),
      ]);
      if (cancelled || !t) {
        setLoading(false);
        return;
      }
      setName(t.name);
      setCity(t.city);
      setDescription(t.description ?? '');
      setAnnouncement(t.announcement ?? '');
      setPhotoUrl(t.photo_url ?? null);
      setMembers(m);
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
    const r = await updateTeam(id, {
      name: name.trim(),
      city: city.trim(),
      description: description.trim() || null,
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
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color="#ffffff" />
        </View>
      </Screen>
    );
  }

  if (!isCaptain) {
    return (
      <Screen>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: 'Editar equipa',
            headerStyle: { backgroundColor: '#0E1812' },
            headerTintColor: '#ffffff',
          }}
        />
        <View style={styles.center}>
          <Text style={styles.deny}>Só o capitão pode editar a equipa.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Editar equipa',
          headerStyle: { backgroundColor: '#0E1812' },
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

          <Text style={styles.label}>Sobre a equipa</Text>
          <TextInput
            style={[styles.input, { minHeight: 96, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Há quanto tempo jogam, identidade, estilo, etc."
            placeholderTextColor="#666"
            multiline
            maxLength={500}
            editable={!submitting}
          />
          <Text style={styles.charCount}>{`${description.length} / 500`}</Text>

          <Text style={[styles.label, { marginTop: 12 }]}>📌 Aviso fixado</Text>
          <Text style={styles.hint}>
            Aparece ao topo do detalhe da equipa para todos os membros.
            Notifica quando publicas.
          </Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top', marginTop: 8 }]}
            value={announcement}
            onChangeText={setAnnouncement}
            placeholder="Ex: Treino de sábado mudou para as 20h."
            placeholderTextColor="#666"
            multiline
            maxLength={280}
            editable={!annBusy && !submitting}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Publicar aviso"
                variant="secondary"
                size="sm"
                loading={annBusy}
                disabled={annBusy || !id || announcement.trim().length === 0}
                onPress={async () => {
                  if (!id) return;
                  setAnnBusy(true);
                  const r = await setTeamAnnouncement(id, announcement.trim());
                  setAnnBusy(false);
                  if (!r.ok) Alert.alert('Erro', r.message);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Limpar"
                variant="ghost"
                size="sm"
                loading={annBusy}
                disabled={annBusy || !id}
                onPress={async () => {
                  if (!id) return;
                  setAnnBusy(true);
                  const r = await setTeamAnnouncement(id, null);
                  setAnnBusy(false);
                  if (r.ok) setAnnouncement('');
                  else Alert.alert('Erro', r.message);
                }}
              />
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Guardar"
            size="lg"
            haptic="medium"
            loading={submitting}
            onPress={handleSubmit}
            full
          />

          <Pressable
            style={styles.coachLink}
            onPress={() => id && router.push(`/(app)/teams/${id}/coach`)}
          >
            <Text style={styles.coachLinkIcon}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.coachLinkTitle}>Treinador</Text>
              <Text style={styles.coachLinkHint}>
                Opcional. Define quem treina a equipa.
              </Text>
            </View>
            <Text style={styles.coachLinkChevron}>›</Text>
          </Pressable>

          {members.filter((m) => m.role !== 'captain').length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 32 }]}>
                Transferir capitania
              </Text>
              <Text style={styles.hint}>
                Promove um membro a capitão. Tu passas a membro e perdes acesso
                ao editar.
              </Text>
              {members
                .filter((m) => m.role !== 'captain')
                .map((m) => (
                  <Pressable
                    key={m.user_id}
                    style={styles.memberRow}
                    onPress={() =>
                      Alert.alert(
                        'Transferir capitania?',
                        `${m.profile?.name ?? 'Este membro'} fica capitão. Tu passas a membro.`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Transferir',
                            style: 'destructive',
                            onPress: async () => {
                              if (!id) return;
                              const r = await transferCaptaincy(id, m.user_id);
                              if (!r.ok) {
                                Alert.alert('Erro', r.message);
                                return;
                              }
                              router.replace(`/(app)/teams/${id}`);
                            },
                          },
                        ],
                      )
                    }
                  >
                    <Avatar
                      url={m.profile?.photo_url}
                      name={m.profile?.name}
                      size={36}
                    />
                    <Text style={styles.memberRowName}>
                      {m.profile?.name ?? 'Membro'}
                    </Text>
                    <Text style={styles.memberRowArrow}>›</Text>
                  </Pressable>
                ))}
            </>
          )}

          <View style={styles.dangerBlock}>
            <Text style={styles.dangerTitle}>Zona perigosa</Text>
            <Pressable
              style={styles.dangerBtn}
              onPress={() =>
                Alert.alert(
                  'Eliminar equipa?',
                  'A equipa fica desativada para todos os membros. Jogos passados ficam preservados, mas não podem ser criados novos. Esta ação não se desfaz.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Eliminar',
                      style: 'destructive',
                      onPress: async () => {
                        if (!id) return;
                        const r = await deactivateTeam(id);
                        if (!r.ok) {
                          Alert.alert('Erro', r.message);
                          return;
                        }
                        router.replace('/(app)');
                      },
                    },
                  ],
                )
              }
            >
              <Text style={styles.dangerBtnText}>Eliminar equipa</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E1812' },
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
  coachLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: 24,
    gap: 12,
  },
  coachLinkIcon: { fontSize: 22 },
  coachLinkTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  coachLinkHint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  coachLinkChevron: { color: colors.textDim, fontSize: 24, fontWeight: '300' },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
  },
  charCount: {
    color: '#5a5a5a',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  memberRowName: { color: '#ffffff', flex: 1, fontSize: 15 },
  memberRowArrow: { color: '#737373', fontSize: 20 },
  dangerBlock: {
    marginTop: 40,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(248,113,113,0.05)',
  },
  dangerTitle: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  dangerBtn: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerBtnText: { color: '#f87171', fontWeight: '600', fontSize: 14 },
});
