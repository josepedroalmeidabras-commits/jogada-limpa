import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
  positionShort,
  type TeamMember,
  type TeamWithSport,
} from '@/lib/teams';
import { createInternalMatch } from '@/lib/internal-match';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

function formatDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function maskDate(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function maskTime(text: string) {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function parseDateTime(date: string, time: string): Date | null {
  const dm = date.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const tm = time.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [, dd, mm, yyyy] = dm;
  const [, hh, mi] = tm;
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

type Assignment = Record<string, 'A' | 'B' | undefined>;

export default function NewInternalMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationTbd, setLocationTbd] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [labelA, setLabelA] = useState('Coletes');
  const [labelB, setLabelB] = useState('Sem coletes');
  const [assign, setAssign] = useState<Assignment>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isCaptain = team?.captain_id === session?.user.id;
  const parsed = parseDateTime(date, time);

  const sideA = useMemo(
    () => members.filter((m) => assign[m.user_id] === 'A'),
    [members, assign],
  );
  const sideB = useMemo(
    () => members.filter((m) => assign[m.user_id] === 'B'),
    [members, assign],
  );
  const unassigned = useMemo(
    () => members.filter((m) => !assign[m.user_id]),
    [members, assign],
  );

  function applyPreset(day: number, hour: number, minute = 0) {
    const target = new Date();
    const diff = (day - target.getDay() + 7) % 7;
    target.setDate(target.getDate() + (diff === 0 ? 7 : diff));
    target.setHours(hour, minute, 0, 0);
    setDate(formatDate(target));
    setTime(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    );
  }

  function assignTo(uid: string, side: 'A' | 'B' | undefined) {
    setAssign((prev) => ({ ...prev, [uid]: side }));
  }

  function autoShuffle() {
    const picks = [...members]
      .filter((m) => assign[m.user_id] !== undefined)
      .map((m) => m.user_id);
    // include all members for an even split
    const all = [...members].map((m) => m.user_id);
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    const next: Assignment = {};
    shuffled.forEach((uid, i) => {
      next[uid] = i < half ? 'A' : 'B';
    });
    setAssign(next);
    void picks;
  }

  function clearAll() {
    setAssign({});
  }

  async function handleSubmit() {
    if (!id || !parsed) return;
    if (sideA.length === 0 || sideB.length === 0) {
      setError('Cada lado precisa de pelo menos 1 jogador.');
      return;
    }
    if (!locationTbd && locationName.trim().length === 0) {
      setError('Indica onde se joga (ou marca "A combinar").');
      return;
    }
    setError(null);
    setSubmitting(true);
    const r = await createInternalMatch({
      team_id: id,
      scheduled_at: parsed.toISOString(),
      location_name: locationTbd ? undefined : locationName.trim(),
      location_tbd: locationTbd,
      notes: notes.trim() || undefined,
      side_a_label: labelA.trim() || undefined,
      side_b_label: labelB.trim() || undefined,
      side_a_user_ids: sideA.map((m) => m.user_id),
      side_b_user_ids: sideB.map((m) => m.user_id),
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    router.replace(`/(app)/matches/${r.match_id}`);
  }

  if (loading) return <Screen>{null}</Screen>;

  if (!team || !isCaptain) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>
            Só o capitão pode marcar peladinhas internas.
          </Text>
        </View>
      </Screen>
    );
  }

  if (members.length < 2) {
    return (
      <Screen>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: 'Peladinha interna',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>
            Precisas de pelo menos 2 membros na equipa.
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
          headerTitle: 'Peladinha interna',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Eyebrow>{team.name}</Eyebrow>
          <Heading level={2} style={{ marginTop: 4 }}>
            Coletes vs Sem coletes
          </Heading>
          <Text style={styles.hint}>
            Dividir o grupo em dois lados ad-hoc. Não conta para o ELO — golos,
            assistências e reviews continuam a contar.
          </Text>

          <Eyebrow style={{ marginTop: 24 }}>Atalhos</Eyebrow>
          <View style={styles.presetRow}>
            {[
              { label: 'Sábado · 19h', day: 6, hour: 19, minute: 0 },
              { label: 'Sábado · 21h', day: 6, hour: 21, minute: 0 },
              { label: 'Domingo · 10h', day: 0, hour: 10, minute: 0 },
            ].map((p) => (
              <Pressable
                key={p.label}
                style={styles.presetChip}
                onPress={() => applyPreset(p.day, p.hour, p.minute)}
              >
                <Text style={styles.presetChipText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <Eyebrow style={{ marginTop: 24 }}>Data</Eyebrow>
          <Card style={{ marginTop: 8, padding: 0 }}>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={(t) => setDate(maskDate(t))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              editable={!submitting}
            />
          </Card>

          <Eyebrow style={{ marginTop: 16 }}>Hora</Eyebrow>
          <Card style={{ marginTop: 8, padding: 0 }}>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={(t) => setTime(maskTime(t))}
              placeholder="HH:MM"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              editable={!submitting}
            />
          </Card>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Local a combinar</Text>
            <Switch
              value={locationTbd}
              onValueChange={setLocationTbd}
              trackColor={{ false: '#3f3f3f', true: colors.brand }}
              thumbColor="#ffffff"
            />
          </View>
          {!locationTbd && (
            <>
              <Eyebrow style={{ marginTop: 16 }}>Onde</Eyebrow>
              <Card style={{ marginTop: 8, padding: 0 }}>
                <TextInput
                  style={styles.input}
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="Campo, pavilhão..."
                  placeholderTextColor={colors.textFaint}
                  editable={!submitting}
                />
              </Card>
            </>
          )}

          <Eyebrow style={{ marginTop: 24 }}>Etiquetas dos lados</Eyebrow>
          <View style={styles.labelsRow}>
            <Card style={{ flex: 1, padding: 0 }}>
              <TextInput
                style={styles.input}
                value={labelA}
                onChangeText={setLabelA}
                placeholder="Lado A"
                placeholderTextColor={colors.textFaint}
                maxLength={20}
                editable={!submitting}
              />
            </Card>
            <Card style={{ flex: 1, padding: 0 }}>
              <TextInput
                style={styles.input}
                value={labelB}
                onChangeText={setLabelB}
                placeholder="Lado B"
                placeholderTextColor={colors.textFaint}
                maxLength={20}
                editable={!submitting}
              />
            </Card>
          </View>

          <View style={styles.actionsRow}>
            <Eyebrow style={{ flex: 1 }}>
              {`Plantel · ${sideA.length + sideB.length}/${members.length}`}
            </Eyebrow>
            <Pressable onPress={autoShuffle} style={styles.utilBtn}>
              <Ionicons name="shuffle" size={14} color={colors.brand} />
              <Text style={styles.utilBtnText}>Sortear</Text>
            </Pressable>
            <Pressable onPress={clearAll} style={styles.utilBtn}>
              <Text style={styles.utilBtnText}>Limpar</Text>
            </Pressable>
          </View>

          {/* Side A list */}
          <Text style={[styles.sideHeader, { color: '#34d399' }]}>
            {`${labelA || 'Lado A'} · ${sideA.length}`}
          </Text>
          {sideA.length === 0 && (
            <Text style={styles.sideEmpty}>Ninguém atribuído ainda.</Text>
          )}
          {sideA.map((m) => (
            <PlayerRow
              key={m.user_id}
              member={m}
              side="A"
              labelA={labelA}
              labelB={labelB}
              onAssign={(side) => assignTo(m.user_id, side)}
            />
          ))}

          {/* Side B list */}
          <Text style={[styles.sideHeader, { color: '#fbbf24', marginTop: 16 }]}>
            {`${labelB || 'Lado B'} · ${sideB.length}`}
          </Text>
          {sideB.length === 0 && (
            <Text style={styles.sideEmpty}>Ninguém atribuído ainda.</Text>
          )}
          {sideB.map((m) => (
            <PlayerRow
              key={m.user_id}
              member={m}
              side="B"
              labelA={labelA}
              labelB={labelB}
              onAssign={(side) => assignTo(m.user_id, side)}
            />
          ))}

          {/* Unassigned */}
          {unassigned.length > 0 && (
            <>
              <Text style={[styles.sideHeader, { marginTop: 16 }]}>
                {`Por atribuir · ${unassigned.length}`}
              </Text>
              {unassigned.map((m) => (
                <PlayerRow
                  key={m.user_id}
                  member={m}
                  side={undefined}
                  labelA={labelA}
                  labelB={labelB}
                  onAssign={(side) => assignTo(m.user_id, side)}
                />
              ))}
            </>
          )}

          <Eyebrow style={{ marginTop: 24 }}>Notas (opcional)</Eyebrow>
          <Card style={{ marginTop: 8, padding: 0 }}>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Combinações, balneário..."
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={200}
              editable={!submitting}
            />
          </Card>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={{ marginTop: 24 }}>
            <Button
              label="Criar peladinha"
              size="lg"
              haptic="medium"
              loading={submitting}
              disabled={!parsed}
              onPress={handleSubmit}
              full
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function PlayerRow({
  member,
  side,
  labelA,
  labelB,
  onAssign,
}: {
  member: TeamMember;
  side: 'A' | 'B' | undefined;
  labelA: string;
  labelB: string;
  onAssign: (side: 'A' | 'B' | undefined) => void;
}) {
  return (
    <View style={styles.playerRow}>
      <Avatar
        url={member.profile?.photo_url ?? null}
        name={member.profile?.name ?? ''}
        size={32}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.playerName} numberOfLines={1}>
          {member.preferred_position === 'gr' ? '🧤 ' : ''}
          {member.profile?.name ?? 'Jogador'}
        </Text>
        {member.preferred_position && (
          <Text style={styles.playerSub}>
            {positionShort(member.preferred_position)}
            {member.elo !== null ? ` · ${Math.round(member.elo)}` : ''}
          </Text>
        )}
      </View>
      <View style={styles.sideBtns}>
        <Pressable
          onPress={() => onAssign(side === 'A' ? undefined : 'A')}
          style={[styles.sideBtn, side === 'A' && styles.sideBtnAActive]}
        >
          <Text
            style={[
              styles.sideBtnText,
              side === 'A' && { color: '#0a0a0a' },
            ]}
            numberOfLines={1}
          >
            {labelA || 'A'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onAssign(side === 'B' ? undefined : 'B')}
          style={[styles.sideBtn, side === 'B' && styles.sideBtnBActive]}
        >
          <Text
            style={[
              styles.sideBtnText,
              side === 'B' && { color: '#0a0a0a' },
            ]}
            numberOfLines={1}
          >
            {labelB || 'B'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 19 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  presetChipText: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  input: { padding: 14, color: colors.text, fontSize: 15 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  toggleLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  labelsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
  },
  utilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  utilBtnText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  sideHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 8,
    marginBottom: 6,
  },
  sideEmpty: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  playerName: { color: colors.text, fontSize: 14, fontWeight: '500' },
  playerSub: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sideBtns: { flexDirection: 'row', gap: 6 },
  sideBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    maxWidth: 100,
  },
  sideBtnAActive: { backgroundColor: '#34d399', borderColor: '#34d399' },
  sideBtnBActive: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  sideBtnText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  error: { color: '#f87171', textAlign: 'center', marginTop: 12, fontSize: 13 },
});
