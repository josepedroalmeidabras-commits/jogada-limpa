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
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  deleteMyAccount,
  fetchProfile,
  updateProfile,
} from '@/lib/profile';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  fetchUserSports,
  setPreferredPosition,
  setSportAvailability,
  type UserSportElo,
} from '@/lib/reviews';
import { setOpenToTeam } from '@/lib/market';
import { pickImage, uploadAvatar } from '@/lib/photos';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export default function EditProfileScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [nickname, setNickname] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [preferredFoot, setPreferredFoot] = useState<'left' | 'right' | 'both' | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sports, setSports] = useState<UserSportElo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const [p, s] = await Promise.all([
        fetchProfile(session.user.id),
        fetchUserSports(session.user.id),
      ]);
      if (cancelled || !p) {
        setLoading(false);
        return;
      }
      setName(p.name);
      setCity(p.city);
      setPhone(p.phone ?? '');
      setBio(p.bio ?? '');
      setNickname(p.nickname ?? '');
      setJerseyNumber(p.jersey_number ? String(p.jersey_number) : '');
      setPreferredFoot(p.preferred_foot ?? null);
      setIsPrivate(p.is_private ?? false);
      setPhotoUrl(p.photo_url ?? null);
      setSports(s);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handlePickAvatar() {
    if (!session) return;
    setError(null);
    const image = await pickImage();
    if (!image) return;
    setUploadingPhoto(true);
    const up = await uploadAvatar(session.user.id, image);
    if (!up.ok) {
      setUploadingPhoto(false);
      setError(up.message);
      return;
    }
    const saved = await updateProfile(session.user.id, {
      // empty diff for other fields, just persist new url via separate call
    });
    // Actually re-use updateProfile by adding photo_url
    const r = await (async () => {
      const { error } = await import('@/lib/supabase').then(({ supabase }) =>
        supabase
          .from('profiles')
          .update({ photo_url: up.publicUrl })
          .eq('id', session.user.id),
      );
      return { ok: !error, message: error?.message };
    })();
    setUploadingPhoto(false);
    if (!r.ok) {
      setError(r.message ?? 'Falhou guardar foto.');
      return;
    }
    setPhotoUrl(up.publicUrl);
    void saved;
  }

  async function toggleOpenToTeam(sportId: number, current: boolean) {
    if (!session) return;
    setSports((prev) =>
      prev.map((s) =>
        s.sport_id === sportId
          ? {
              ...s,
              is_open_to_team: !current,
              open_to_team_until: !current
                ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                : null,
            }
          : s,
      ),
    );
    const r = await setOpenToTeam(session.user.id, sportId, !current);
    if (!r.ok) {
      setError(r.message);
      setSports((prev) =>
        prev.map((s) =>
          s.sport_id === sportId
            ? { ...s, is_open_to_team: current }
            : s,
        ),
      );
    }
  }

  async function pickPosition(
    sportId: number,
    position: string | null,
  ) {
    if (!session) return;
    // optimistic
    setSports((prev) =>
      prev.map((s) =>
        s.sport_id === sportId ? { ...s, preferred_position: position } : s,
      ),
    );
    const r = await setPreferredPosition(session.user.id, sportId, position);
    if (!r.ok) {
      setError(r.message);
    }
  }

  async function toggleAvailability(sportId: number, current: boolean) {
    if (!session) return;
    // optimistic
    setSports((prev) =>
      prev.map((s) =>
        s.sport_id === sportId
          ? {
              ...s,
              is_open_to_sub: !current,
              open_until: !current
                ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                : null,
            }
          : s,
      ),
    );
    const r = await setSportAvailability(session.user.id, sportId, !current);
    if (!r.ok) {
      setError(r.message);
      // revert
      setSports((prev) =>
        prev.map((s) =>
          s.sport_id === sportId
            ? { ...s, is_open_to_sub: current }
            : s,
        ),
      );
    }
  }

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
    const parsedJersey = jerseyNumber.trim() ? parseInt(jerseyNumber, 10) : null;
    if (parsedJersey !== null && (Number.isNaN(parsedJersey) || parsedJersey < 1 || parsedJersey > 99)) {
      setError('Número de camisola deve ser entre 1 e 99.');
      return;
    }
    setSubmitting(true);
    const r = await updateProfile(session.user.id, {
      name: name.trim(),
      city: city.trim(),
      phone: phone.trim() || null,
      bio: bio.trim() || null,
      nickname: nickname.trim() || null,
      jersey_number: parsedJersey,
      preferred_foot: preferredFoot,
      is_private: isPrivate,
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

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Editar perfil',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
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
              onPress={handlePickAvatar}
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
                  {photoUrl ? 'Mudar foto' : 'Adicionar foto'}
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

          <Text style={styles.label}>Telemóvel (opcional)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!submitting}
          />

          <Text style={styles.label}>Alcunha (opcional)</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder='Tipo "Bombas", "Pistola"... aparece entre aspas'
            placeholderTextColor="#666"
            autoCapitalize="words"
            maxLength={20}
            editable={!submitting}
          />

          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Camisola</Text>
              <TextInput
                style={styles.input}
                value={jerseyNumber}
                onChangeText={(t) => setJerseyNumber(t.replace(/\D/g, '').slice(0, 2))}
                placeholder="1-99"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                maxLength={2}
                editable={!submitting}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Pé preferido</Text>
              <View style={styles.footRow}>
                {(
                  [
                    { v: 'left', label: 'Esquerdo' },
                    { v: 'right', label: 'Direito' },
                    { v: 'both', label: 'Ambos' },
                  ] as const
                ).map((opt) => {
                  const active = preferredFoot === opt.v;
                  return (
                    <Pressable
                      key={opt.v}
                      onPress={() =>
                        setPreferredFoot(active ? null : opt.v)
                      }
                      style={[styles.footChip, active && styles.footChipActive]}
                    >
                      <Text
                        style={[
                          styles.footChipText,
                          active && styles.footChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <Text style={styles.label}>Bio (opcional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Posição preferida, estilo de jogo, há quanto tempo jogas..."
            placeholderTextColor="#666"
            multiline
            maxLength={300}
            editable={!submitting}
          />
          <Text style={styles.charHint}>{`${bio.length} / 300`}</Text>

          <Text style={[styles.label, { marginTop: 24 }]}>Privacidade</Text>
          <Pressable
            onPress={() => setIsPrivate((v) => !v)}
            disabled={submitting}
            style={styles.privacyRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyTitle}>
                {isPrivate ? 'Perfil privado' : 'Perfil público'}
              </Text>
              <Text style={styles.privacyBody}>
                {isPrivate
                  ? 'Só amigos podem ver as tuas estatísticas e jogos. Outros vêem só nome e cidade.'
                  : 'Qualquer pessoa pode ver o teu perfil completo, jogos e estatísticas.'}
              </Text>
            </View>
            <View
              style={[styles.toggle, isPrivate && styles.toggleOn]}
            >
              <View
                style={[styles.toggleKnob, isPrivate && styles.toggleKnobOn]}
              />
            </View>
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            label="Guardar"
            size="lg"
            haptic="medium"
            loading={submitting}
            onPress={handleSubmit}
            full
          />

          <Text style={[styles.label, { marginTop: 32 }]}>Posição preferida</Text>
          <Text style={styles.subhint}>
            Se escolheres "Guarda-redes", os atributos PES mudam para o set
            específico (reflexos, defesa aérea, etc.).
          </Text>
          {sports.map((s) => (
            <View key={`pos-${s.sport_id}`} style={{ marginBottom: 12 }}>
              <Text style={styles.posSportLabel}>{s.sport?.name}</Text>
              <View style={styles.posRow}>
                {(
                  [
                    { v: 'gr', label: '🧤 GR' },
                    { v: 'def', label: 'Defesa' },
                    { v: 'med', label: 'Médio' },
                    { v: 'ata', label: 'Avançado' },
                  ] as const
                ).map((opt) => {
                  const active = s.preferred_position === opt.v;
                  return (
                    <Pressable
                      key={opt.v}
                      onPress={() =>
                        pickPosition(s.sport_id, active ? null : opt.v)
                      }
                      style={[
                        styles.posChip,
                        active && styles.posChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.posChipText,
                          active && styles.posChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <Text style={[styles.label, { marginTop: 24 }]}>
            Disponibilidade para substituir
          </Text>
          <Text style={styles.subhint}>
            Ativa por desporto para apareceres na lista de jogadores
            disponíveis. Expira automaticamente passados 7 dias.
          </Text>
          {sports.map((s) => (
            <Pressable
              key={s.sport_id}
              style={styles.availRow}
              onPress={() => toggleAvailability(s.sport_id, s.is_open_to_sub)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.availName}>{s.sport?.name}</Text>
                {s.is_open_to_sub && s.open_until && (
                  <Text style={styles.availMeta}>
                    Aberto até{' '}
                    {new Date(s.open_until).toLocaleDateString('pt-PT')}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.toggle,
                  s.is_open_to_sub && styles.toggleOn,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    s.is_open_to_sub && styles.toggleKnobOn,
                  ]}
                />
              </View>
            </Pressable>
          ))}

          <Text style={[styles.label, { marginTop: 32 }]}>
            Mercado livre — quero entrar numa equipa
          </Text>
          <Text style={styles.subhint}>
            Aparece a capitães em "Mercado livre" para te convidarem para a
            equipa deles. Expira em 30 dias.
          </Text>
          {sports.map((s) => (
            <Pressable
              key={`team-${s.sport_id}`}
              style={styles.availRow}
              onPress={() => toggleOpenToTeam(s.sport_id, s.is_open_to_team)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.availName}>{s.sport?.name}</Text>
                {s.is_open_to_team && s.open_to_team_until && (
                  <Text style={styles.availMeta}>
                    Disponível até{' '}
                    {new Date(s.open_to_team_until).toLocaleDateString('pt-PT')}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.toggle,
                  s.is_open_to_team && styles.toggleOn,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    s.is_open_to_team && styles.toggleKnobOn,
                  ]}
                />
              </View>
            </Pressable>
          ))}

          <Text style={styles.hint}>
            Para editar desportos ou nível inicial, contacta o suporte.
          </Text>

          <Pressable
            style={styles.linkRow}
            onPress={() => router.push('/(app)/profile/notifications')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.linkRowLabel}>Notificações</Text>
              <Text style={styles.linkRowHint}>
                Escolhe que avisos queres receber.
              </Text>
            </View>
            <Text style={styles.linkRowChevron}>›</Text>
          </Pressable>

          <Pressable
            style={[styles.linkRow, { marginTop: 8 }]}
            onPress={() => router.push('/(app)/profile/friends')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.linkRowLabel}>Amigos</Text>
              <Text style={styles.linkRowHint}>
                Vê quem é teu amigo e gere pedidos.
              </Text>
            </View>
            <Text style={styles.linkRowChevron}>›</Text>
          </Pressable>

          <Pressable
            style={[styles.linkRow, { marginTop: 8 }]}
            onPress={() => router.push('/(app)/profile/blocked')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.linkRowLabel}>Jogadores bloqueados</Text>
              <Text style={styles.linkRowHint}>
                Gere a lista de quem bloqueaste.
              </Text>
            </View>
            <Text style={styles.linkRowChevron}>›</Text>
          </Pressable>

          <Pressable
            style={[styles.linkRow, { marginTop: 8 }]}
            onPress={() => router.push('/(app)/profile/about')}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.linkRowLabel}>Sobre a app</Text>
              <Text style={styles.linkRowHint}>
                Versão, termos, privacidade e suporte.
              </Text>
            </View>
            <Text style={styles.linkRowChevron}>›</Text>
          </Pressable>

          <View style={styles.dangerBlock}>
            <Text style={styles.dangerTitle}>Zona perigosa</Text>
            <Pressable
              style={styles.dangerBtn}
              onPress={() => {
                Alert.alert(
                  'Eliminar conta?',
                  'O teu perfil fica anonimizado. Não podes desfazer. Os teus jogos passados ficam, mas com o nome "Conta apagada".',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Eliminar',
                      style: 'destructive',
                      onPress: async () => {
                        const r = await deleteMyAccount();
                        if (!r.ok) {
                          Alert.alert('Erro', r.message);
                          return;
                        }
                        await supabase.auth.signOut();
                        router.replace('/(auth)/login');
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={styles.dangerBtnText}>Eliminar a minha conta</Text>
            </Pressable>
            <Text style={styles.dangerHint}>
              Se és capitão de equipa, transfere a capitania ou pede ao
              suporte primeiro.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E1812' },
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
  charHint: {
    color: '#5a5a5a',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  rowFields: { flexDirection: 'row', gap: 12 },
  footRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  footChip: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  footChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  footChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  footChipTextActive: { color: '#0E1812' },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginTop: 8,
  },
  privacyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  privacyBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  posSportLabel: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  posRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  posChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  posChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  posChipText: { color: '#a3a3a3', fontSize: 12, fontWeight: '700' },
  posChipTextActive: { color: '#0E1812' },
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
  subhint: { color: '#737373', fontSize: 12, marginBottom: 12, lineHeight: 16 },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  availName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  availMeta: { color: colors.brand, fontSize: 12, marginTop: 2 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.brand },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginTop: 24,
    gap: 12,
  },
  linkRowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  linkRowHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  linkRowChevron: {
    color: colors.textDim,
    fontSize: 24,
    fontWeight: '300',
  },
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
  dangerHint: {
    color: '#a3a3a3',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
