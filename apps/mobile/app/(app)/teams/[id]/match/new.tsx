import { useEffect, useRef, useState } from 'react';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchTeamById, isTeamLeader, type TeamWithSport } from '@/lib/teams';
import { fetchLocationsByCity, type Location } from '@/lib/locations';
import { Ionicons } from '@expo/vector-icons';
import {
  balanceLabel,
  fetchOpponentCandidates,
  fetchTeamEloStats,
  fetchTeamsRecentForm,
  proposeMatch,
  type FormResult,
  type TeamEloStats,
  type TeamLite,
} from '@/lib/matches';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

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

export default function NewMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [opponents, setOpponents] = useState<TeamLite[]>([]);
  const [eloStats, setEloStats] = useState<Record<string, TeamEloStats>>({});
  const [forms, setForms] = useState<Record<string, FormResult[]>>({});
  const [myTeamElo, setMyTeamElo] = useState<number>(1200);
  const [eloFilter, setEloFilter] = useState<'all' | '100' | '200'>('all');
  const [loading, setLoading] = useState(true);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationTbd, setLocationTbd] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | 'other' | null>(null);
  const timeScrollRef = useRef<ScrollView | null>(null);

  // Auto-scroll time picker to 18:00 zone (popular slot)
  useEffect(() => {
    const t = setTimeout(() => {
      // 9h:00 is index 0, each slot ~72px wide (paddingH 14 + text ~36 + gap 8)
      // 18:00 is index (18-9)*2 = 18 → offset ≈ 18*72 = 1296
      timeScrollRef.current?.scrollTo({ x: 1180, animated: false });
    }, 100);
    return () => clearTimeout(t);
  }, []);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const t = await fetchTeamById(id);
      if (cancelled || !t) {
        setLoading(false);
        return;
      }
      setTeam(t);
      const locs = await fetchLocationsByCity(t.city);
      if (!cancelled) setLocations(locs);
      const list = await fetchOpponentCandidates(t.sport_id, t.id);
      if (cancelled) return;
      const stats = await fetchTeamEloStats([t.id, ...list.map((l) => l.id)]);
      if (cancelled) return;
      setMyTeamElo(stats[t.id]?.elo_avg ?? 1200);
      // sort opponents by ELO closeness to my team
      const sorted = [...list].sort((a, b) => {
        const da = Math.abs((stats[a.id]?.elo_avg ?? 1200) - (stats[t.id]?.elo_avg ?? 1200));
        const db = Math.abs((stats[b.id]?.elo_avg ?? 1200) - (stats[t.id]?.elo_avg ?? 1200));
        return da - db;
      });
      setOpponents(sorted);
      setEloStats(stats);
      const form = await fetchTeamsRecentForm(list.map((l) => l.id));
      if (cancelled) return;
      setForms(form);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSubmit() {
    setError(null);
    if (!session || !team) {
      setError('Sessão inválida.');
      return;
    }
    if (!isTeamLeader(team, session.user.id)) {
      setError('Só o capitão ou sub-capitão pode marcar jogos.');
      return;
    }
    if (!opponentId) {
      setError('Escolhe um adversário.');
      return;
    }
    const scheduledIso = parseDateTime(date, time);
    if (!scheduledIso) {
      setError('Data ou hora inválida. Tem de ser no futuro.');
      return;
    }
    if (!locationTbd && !locationName.trim()) {
      setError('Indica o local ou marca "A combinar".');
      return;
    }

    setSubmitting(true);
    const result = await proposeMatch({
      proposing_team_id: team.id,
      opponent_team_id: opponentId,
      scheduled_at: scheduledIso,
      location_name: locationTbd ? undefined : locationName.trim(),
      location_tbd: locationTbd,
      message: message.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(`/(app)/matches/${result.match_id}`);
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

  if (!team) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>Equipa não encontrada.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Marcar jogo',
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
        >
          <Text style={styles.heading}>{team.name}</Text>
          <Text style={styles.sub}>
            {team.sport?.name} · vai propor um jogo
          </Text>

          <Text style={styles.label}>Adversário</Text>
          {opponents.length === 0 ? (
            <Text style={styles.emptyOpp}>
              Ainda não há outras equipas de {team.sport?.name} para desafiar.
              Convida amigos a criarem equipa.
            </Text>
          ) : (
            <View style={styles.opponents}>
              <Text style={styles.myEloLine}>
                A tua equipa: ELO médio {Math.round(myTeamElo)}
              </Text>

              <View style={styles.filterRow}>
                {(
                  [
                    { v: 'all' as const, label: 'Qualquer' },
                    { v: '200' as const, label: '±200' },
                    { v: '100' as const, label: '±100' },
                  ]
                ).map((f) => {
                  const active = eloFilter === f.v;
                  return (
                    <Pressable
                      key={f.v}
                      onPress={() => setEloFilter(f.v)}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {opponents
                .filter((o) => {
                  if (eloFilter === 'all') return true;
                  const oppElo = eloStats[o.id]?.elo_avg ?? 1200;
                  const range = eloFilter === '100' ? 100 : 200;
                  return Math.abs(oppElo - myTeamElo) <= range;
                })
                .map((o) => {
                const picked = o.id === opponentId;
                const stat = eloStats[o.id];
                const oppElo = stat?.elo_avg ?? 1200;
                const diff = oppElo - myTeamElo;
                const balance = balanceLabel(diff);
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setOpponentId(o.id)}
                    disabled={submitting}
                    style={[styles.oppCard, picked && styles.oppCardPicked]}
                  >
                    <View style={styles.oppRow}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.oppName,
                            picked && styles.oppNamePicked,
                          ]}
                        >
                          {o.name}
                        </Text>
                        <Text
                          style={[
                            styles.oppCity,
                            picked && styles.oppCityPicked,
                          ]}
                        >
                          {o.city} · {stat?.member_count ?? 0} membros · ELO{' '}
                          {Math.round(oppElo)}
                        </Text>
                        {forms[o.id] && forms[o.id]!.length > 0 && (
                          <View style={styles.formRow}>
                            {forms[o.id]!.map((r, idx) => (
                              <View
                                key={idx}
                                style={[
                                  styles.formDot,
                                  r === 'W' && styles.formDotWin,
                                  r === 'D' && styles.formDotDraw,
                                  r === 'L' && styles.formDotLoss,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.formDotText,
                                    picked && styles.formDotTextPicked,
                                  ]}
                                >
                                  {r}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      <View
                        style={[
                          styles.balancePill,
                          balance.color === 'up' && styles.balanceUp,
                          balance.color === 'down' && styles.balanceDown,
                        ]}
                      >
                        <Text style={styles.balanceText}>{balance.label}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

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
                      style={[
                        styles.locIcon,
                        active && styles.locIconActive,
                      ]}
                    >
                      <Ionicons
                        name="location"
                        size={14}
                        color={active ? colors.brand : colors.textDim}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.locName,
                          active && styles.locNameActive,
                        ]}
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
                color={selectedLocationId === 'other' ? colors.brand : colors.textDim}
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
              style={[styles.locExtraChip, locationTbd && styles.locExtraChipActive]}
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

          <Text style={styles.label}>Mensagem (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Algo a dizer ao outro capitão?"
            placeholderTextColor="#666"
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
            editable={!submitting}
          />

          <Text style={styles.label}>Notas do jogo (opcional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Cor de equipamento, balneário, o que levar..."
            placeholderTextColor="#666"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={300}
            editable={!submitting}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={{ alignSelf: 'stretch' }}>
            <Button
              label="Enviar desafio"
              size="lg"
              haptic="medium"
              loading={submitting}
              disabled={opponents.length === 0}
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
  safe: { flex: 1, backgroundColor: '#0E1812' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48, alignItems: 'stretch' },
  heading: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 4, marginBottom: 16 },
  label: {
    color: colors.textMuted,
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
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  opponents: { gap: 8, marginTop: 4 },
  myEloLine: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  filterChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterChipText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#0E1812' },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  presetChipText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  chipScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  dayChip: {
    width: 64,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
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
  timeChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  timeChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  timeChipTextPopular: { color: colors.goldDeep },
  timeChipTextActive: { color: '#0E1812' },
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
  locRowActive: {
    backgroundColor: colors.brandSoft,
  },
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
  locExtras: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
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
  locExtraText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  locExtraTextActive: { color: colors.brand },
  formRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  formDot: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  formDotWin: { backgroundColor: colors.brand },
  formDotDraw: { backgroundColor: colors.warning },
  formDotLoss: { backgroundColor: colors.danger },
  formDotText: {
    color: '#0E1812',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  formDotTextPicked: { color: '#0E1812' },
  oppCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  oppRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balancePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  balanceUp: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(248,113,113,0.4)',
  },
  balanceDown: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderColor: 'rgba(52,211,153,0.4)',
  },
  balanceText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  oppCardPicked: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  oppName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  oppNamePicked: { color: '#000000' },
  oppCity: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  oppCityPicked: { color: '#404040' },
  emptyOpp: {
    color: colors.textMuted,
    fontSize: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    lineHeight: 20,
  },
  tbdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  checkboxMark: { color: '#000000', fontWeight: '800', fontSize: 14 },
  tbdText: { color: '#d4d4d4', fontSize: 14 },
  submit: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#000000', fontSize: 16, fontWeight: '600' },
  error: {
    color: '#f87171',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
  },
});
