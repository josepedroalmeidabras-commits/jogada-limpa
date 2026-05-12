import { useState } from 'react';
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
import { rescheduleMatch } from '@/lib/matches';
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
  if (d.getTime() <= Date.now()) return null;
  return d;
}

export default function RescheduleMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsed = parseDateTime(date, time);

  function applyPreset(day: number, hour: number, minute = 0) {
    const target = new Date();
    const diff = (day - target.getDay() + 7) % 7 || 7;
    target.setDate(target.getDate() + diff);
    target.setHours(hour, minute, 0, 0);
    setDate(formatDate(target));
    setTime(
      `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    );
  }

  async function handleSubmit() {
    if (!id || !parsed) return;
    setSubmitting(true);
    const r = await rescheduleMatch(id, parsed);
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    Alert.alert(
      'Remarcado',
      'O adversário foi notificado para confirmar a nova data.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Remarcar',
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
          showsVerticalScrollIndicator={false}
        >
          <Eyebrow>Nova data</Eyebrow>
          <Heading level={2} style={{ marginTop: 4 }}>
            Para quando?
          </Heading>
          <Text style={styles.hint}>
            Se já estava confirmado, vai voltar a "Proposto" e precisa de
            aceitação da outra equipa.
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

          <View style={{ marginTop: 24 }}>
            <Button
              label="Propor nova data"
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
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 19 },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  presetChipText: { color: colors.brand, fontWeight: '700', fontSize: 13 },
  input: {
    padding: 14,
    color: colors.text,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
