import { useEffect, useState } from 'react';
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
import { useAuth } from '@/providers/auth';
import { fetchTeamById, type TeamWithSport } from '@/lib/teams';
import { announceInternalMatch } from '@/lib/internal-match';
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

export default function NewInternalMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [team, setTeam] = useState<TeamWithSport | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationTbd, setLocationTbd] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [notes, setNotes] = useState('');
  const [labelA, setLabelA] = useState('Coletes');
  const [labelB, setLabelB] = useState('Sem coletes');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const t = await fetchTeamById(id);
      if (cancelled) return;
      setTeam(t);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isCaptain = team?.captain_id === session?.user.id;
  const parsed = parseDateTime(date, time);

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

  async function handleSubmit() {
    if (!id || !parsed) return;
    if (!locationTbd && locationName.trim().length === 0) {
      setError('Indica onde se joga (ou marca "A combinar").');
      return;
    }
    setError(null);
    setSubmitting(true);
    const r = await announceInternalMatch({
      team_id: id,
      scheduled_at: parsed.toISOString(),
      location_name: locationTbd ? undefined : locationName.trim(),
      location_tbd: locationTbd,
      notes: notes.trim() || undefined,
      side_a_label: labelA.trim() || undefined,
      side_b_label: labelB.trim() || undefined,
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    Alert.alert(
      'Peladinha anunciada',
      'Todos os membros receberam o convite. Aguarda confirmações e depois divide os lados.',
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
            Só o capitão pode marcar peladinhas internas.
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
            Anunciar peladinha
          </Heading>
          <Text style={styles.hint}>
            Marcas o dia e o local; todos os membros recebem convite e
            confirmam se vão. Depois divides os lados entre quem aceitou.
            Sem limite de jogadores — pode ser 5v5, 7v7, 8v8 ou mais.
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

          <Eyebrow style={{ marginTop: 24 }}>Notas (opcional)</Eyebrow>
          <Card style={{ marginTop: 8, padding: 0 }}>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Cor de equipamento, o que levar..."
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={200}
              editable={!submitting}
            />
          </Card>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={{ marginTop: 24 }}>
            <Button
              label="Anunciar e convocar plantel"
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
  error: { color: '#f87171', textAlign: 'center', marginTop: 12, fontSize: 13 },
});
