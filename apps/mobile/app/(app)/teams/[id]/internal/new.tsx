import { useEffect, useRef, useState } from 'react';
import {
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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/auth';
import {
  fetchTeamById,
  fetchTeamMembers,
  isTeamLeader,
  type TeamMember,
  type TeamWithSport,
} from '@/lib/teams';
import { fetchLocationsByCity, type Location } from '@/lib/locations';
import { announceInternalMatch } from '@/lib/internal-match';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

function parseDateTime(date: string, time: string): string | null {
  const dm = date.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const tm = time.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [, dd, mm, yyyy] = dm;
  const [, hh, mi] = tm;
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() <= Date.now()) return null;
  return d.toISOString();
}

export default function NewInternalMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<
    string | 'other' | null
  >(null);
  const [locationTbd, setLocationTbd] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [labelA, setLabelA] = useState('Coletes');
  const [labelB, setLabelB] = useState('Sem coletes');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [t, m] = await Promise.all([
        fetchTeamById(id),
        fetchTeamMembers(id),
      ]);
      if (cancelled) return;
      setTeam(t);
      setMembers(m);
      setInvited(new Set(m.map((mm) => mm.user_id)));
      if (t) {
        const locs = await fetchLocationsByCity(t.city);
        if (!cancelled) setLocations(locs);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Auto-scroll time picker para a zona popular (18h)
  useEffect(() => {
    const t = setTimeout(() => {
      timeScrollRef.current?.scrollTo({ x: 1180, animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, []);

  function toggleInvited(userId: string) {
    setInvited((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const isCaptain = isTeamLeader(team, session?.user.id);

  async function handleSubmit() {
    setError(null);
    if (!id) return;
    const scheduledIso = parseDateTime(date, time);
    if (!scheduledIso) {
      setError('Escolhe um dia e hora no futuro.');
      return;
    }
    if (!locationTbd && !locationName.trim()) {
      setError('Indica onde se joga (ou marca "A combinar").');
      return;
    }
    if (invited.size === 0) {
      setError('Convoca pelo menos 1 jogador.');
      return;
    }
    setSubmitting(true);
    const r = await announceInternalMatch({
      team_id: id,
      scheduled_at: scheduledIso,
      location_name: locationTbd ? undefined : locationName.trim(),
      location_tbd: locationTbd,
      notes: notes.trim() || undefined,
      side_a_label: labelA.trim() || undefined,
      side_b_label: labelB.trim() || undefined,
      invite_user_ids: Array.from(invited),
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    Alert.alert(
      'Peladinha anunciada',
      `${invited.size} convocado(s). Receberam o convite e podem aceitar/recusar.`,
      [
        {
          text: 'Ver convocatória',
          onPress: () => router.replace(`/(app)/matches/${r.match_id}`),
        },
      ],
    );
  }

  if (loading) return <Screen>{null}</Screen>;

  if (!team || !isCaptain) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>
            Só o capitão ou sub-capitão pode marcar peladinhas internas.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Marcar peladinha',
          headerStyle: { backgroundColor: '#0E1812' },
          headerTintColor: '#ffffff',
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>{team.name}</Text>
          <Text style={styles.sub}>
            Peladinha interna · convocas o plantel e divides os lados
          </Text>

          {/* DAY CHIPS */}
          <Text style={styles.label}>Dia</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {(() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
              return Array.from({ length: 14 }, (_, i) => {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                const dateStr = `${dd}/${mm}/${yyyy}`;
                const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : days[d.getDay()]!;
                const active = date === dateStr;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setDate(dateStr)}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                  >
                    <Text style={[styles.dayChipLabel, active && styles.dayChipLabelActive]}>
                      {label}
                    </Text>
                    <Text style={[styles.dayChipDate, active && styles.dayChipDateActive]}>
                      {`${dd}/${mm}`}
                    </Text>
                  </Pressable>
                );
              });
            })()}
          </ScrollView>

          {/* TIME CHIPS */}
          <View style={styles.labelRow}>
            <Text style={styles.label}>Hora</Text>
            <Text style={styles.labelHint}>Mais jogos · 18h–23h</Text>
          </View>
          <ScrollView
            ref={timeScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {(() => {
              const slots: string[] = [];
              for (let h = 9; h <= 23; h++) {
                slots.push(`${String(h).padStart(2, '0')}:00`);
                slots.push(`${String(h).padStart(2, '0')}:30`);
              }
              return slots.map((s) => {
                const active = time === s;
                const hour = parseInt(s.slice(0, 2), 10);
                const popular = hour >= 18 && hour <= 23;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setTime(s)}
                    style={[
                      styles.timeChip,
                      popular && !active && styles.timeChipPopular,
                      active && styles.timeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeChipText,
                        popular && !active && styles.timeChipTextPopular,
                        active && styles.timeChipTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              });
            })()}
          </ScrollView>

          {/* LOCATIONS */}
          <Text style={styles.label}>Local</Text>
          <View style={styles.locList}>
            <ScrollView
              style={{ maxHeight: 220 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {locations.map((loc, idx) => {
                const active = selectedLocationId === loc.id;
                return (
                  <Pressable
                    key={loc.id}
                    onPress={() => {
                      setSelectedLocationId(loc.id);
                      setLocationName(loc.name);
                      setLocationTbd(false);
                    }}
                    style={[
                      styles.locRow,
                      idx > 0 && styles.locRowBorder,
                      active && styles.locRowActive,
                    ]}
                  >
                    <View
                      style={[styles.locIcon, active && styles.locIconActive]}
                    >
                      <Ionicons
                        name="location"
                        size={14}
                        color={active ? colors.brand : colors.textDim}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[styles.locName, active && styles.locNameActive]}
                        numberOfLines={1}
                      >
                        {loc.name}
                      </Text>
                      {loc.address && (
                        <Text style={styles.locAddress} numberOfLines={1}>
                          {loc.address}
                        </Text>
                      )}
                    </View>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={colors.brand}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.locExtras}>
            <Pressable
              onPress={() => {
                setSelectedLocationId('other');
                setLocationName('');
                setLocationTbd(false);
              }}
              style={[
                styles.locExtraChip,
                selectedLocationId === 'other' && styles.locExtraChipActive,
              ]}
            >
              <Ionicons
                name="create-outline"
                size={13}
                color={
                  selectedLocationId === 'other' ? colors.brand : colors.textDim
                }
              />
              <Text
                style={[
                  styles.locExtraText,
                  selectedLocationId === 'other' && styles.locExtraTextActive,
                ]}
              >
                Outro local
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setLocationTbd(true);
                setSelectedLocationId(null);
                setLocationName('');
              }}
              style={[
                styles.locExtraChip,
                locationTbd && styles.locExtraChipActive,
              ]}
            >
              <Ionicons
                name="help-circle-outline"
                size={13}
                color={locationTbd ? colors.brand : colors.textDim}
              />
              <Text
                style={[
                  styles.locExtraText,
                  locationTbd && styles.locExtraTextActive,
                ]}
              >
                A combinar
              </Text>
            </Pressable>
          </View>

          {selectedLocationId === 'other' && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Nome do local"
              placeholderTextColor="#666"
              value={locationName}
              onChangeText={setLocationName}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!submitting}
            />
          )}

          {/* SIDE LABELS */}
          <Text style={styles.label}>Etiquetas dos lados</Text>
          <View style={styles.labelsRow}>
            <View style={[styles.input, styles.labelInputWrap]}>
              <TextInput
                style={styles.labelInput}
                value={labelA}
                onChangeText={setLabelA}
                placeholder="Lado A"
                placeholderTextColor="#666"
                maxLength={20}
                editable={!submitting}
              />
            </View>
            <View style={[styles.input, styles.labelInputWrap]}>
              <TextInput
                style={styles.labelInput}
                value={labelB}
                onChangeText={setLabelB}
                placeholder="Lado B"
                placeholderTextColor="#666"
                maxLength={20}
                editable={!submitting}
              />
            </View>
          </View>

          {/* NOTES */}
          <Text style={styles.label}>Notas (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Cor de equipamento, o que levar..."
            placeholderTextColor="#666"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={200}
            editable={!submitting}
          />

          {/* INVITE LIST */}
          <View style={styles.inviteHeader}>
            <Text style={styles.label}>
              {`Convocar plantel · ${invited.size}/${members.length}`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() =>
                  setInvited(new Set(members.map((m) => m.user_id)))
                }
                disabled={submitting}
              >
                <Text style={styles.inviteAction}>Todos</Text>
              </Pressable>
              <Text style={styles.inviteSep}>·</Text>
              <Pressable
                onPress={() => setInvited(new Set())}
                disabled={submitting}
              >
                <Text style={styles.inviteAction}>Nenhum</Text>
              </Pressable>
            </View>
          </View>
          <Text style={styles.hint}>
            Toca para tirar alguém da convocatória. Os convocados recebem
            notificação e confirmam se vão.
          </Text>
          <View style={{ marginTop: 8, gap: 6 }}>
            {members.map((m) => {
              const on = invited.has(m.user_id);
              return (
                <Pressable
                  key={m.user_id}
                  style={[styles.inviteRow, on && styles.inviteRowOn]}
                  onPress={() => toggleInvited(m.user_id)}
                  disabled={submitting}
                >
                  <Avatar
                    url={m.profile?.photo_url}
                    name={m.profile?.name}
                    size={32}
                  />
                  <Text style={styles.inviteName}>
                    {m.profile?.name ?? 'Membro'}
                    {m.user_id === session?.user.id ? ' · tu' : ''}
                  </Text>
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on && <Text style={styles.checkboxTick}>✓</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={{ alignSelf: 'stretch', marginTop: 28 }}>
            <Button
              label="Anunciar e convocar plantel"
              size="lg"
              haptic="medium"
              loading={submitting}
              disabled={!parseDateTime(date, time)}
              onPress={handleSubmit}
              full
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  scroll: { padding: 24, paddingBottom: 48, alignItems: 'stretch' },
  heading: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 6, lineHeight: 19 },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  labelHint: {
    color: colors.goldDeep,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  // Day & time chips
  chipScroll: { gap: 8, paddingVertical: 4 },
  dayChip: {
    width: 64,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  dayChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  dayChipLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayChipLabelActive: { color: '#0E1812' },
  dayChipDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  dayChipDateActive: { color: '#0E1812' },
  timeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  timeChipPopular: {
    borderColor: colors.goldDim,
    backgroundColor: 'rgba(201,162,107,0.08)',
  },
  timeChipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  timeChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timeChipTextPopular: { color: colors.goldDeep },
  timeChipTextActive: { color: '#0E1812' },

  // Locations
  locList: {
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  locRowActive: { backgroundColor: colors.brandSoft },
  locIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locIconActive: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.goldDim,
  },
  locName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  locNameActive: { color: colors.brand },
  locAddress: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  locExtras: { flexDirection: 'row', gap: 8, marginTop: 10 },
  locExtraChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  locExtraChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  locExtraText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  locExtraTextActive: { color: colors.brand },

  // Side labels
  labelsRow: { flexDirection: 'row', gap: 8 },
  labelInputWrap: { flex: 1, paddingVertical: 0 },
  labelInput: { color: '#ffffff', fontSize: 16, paddingVertical: 12 },

  // Invite list
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  inviteAction: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inviteSep: { color: colors.textDim, fontSize: 12 },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  inviteRowOn: {
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  inviteName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { borderColor: colors.brand, backgroundColor: colors.brand },
  checkboxTick: { color: '#0E1812', fontSize: 14, fontWeight: '900' },

  error: { color: '#f87171', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
