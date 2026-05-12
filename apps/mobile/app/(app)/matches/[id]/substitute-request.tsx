import { useEffect, useState } from 'react';
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
import { useAuth } from '@/providers/auth';
import { fetchMatchById, type MatchSummary } from '@/lib/matches';
import { postSubstituteRequest } from '@/lib/substitute-requests';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

const POSITIONS: Array<{ v: string; label: string }> = [
  { v: '', label: 'Qualquer' },
  { v: 'gr', label: '🧤 GR' },
  { v: 'def', label: 'Defesa' },
  { v: 'med', label: 'Médio' },
  { v: 'ata', label: 'Avançado' },
];

export default function SubstituteRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [position, setPosition] = useState<string>('');
  const [count, setCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const m = await fetchMatchById(id);
      if (cancelled) return;
      setMatch(m);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Screen>{null}</Screen>;
  if (!match) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>Jogo não encontrado.</Text>
        </View>
      </Screen>
    );
  }
  if (match.is_internal) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>
            Para peladinhas, usa o flow de convocatória interno.
          </Text>
        </View>
      </Screen>
    );
  }

  const isCaptainA = match.side_a.captain_id === session?.user.id;
  const isCaptainB = match.side_b.captain_id === session?.user.id;
  if (!isCaptainA && !isCaptainB) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>Só o capitão do teu lado pode pedir substituto.</Text>
        </View>
      </Screen>
    );
  }
  const mySide: 'A' | 'B' = isCaptainA ? 'A' : 'B';
  const sideName =
    mySide === 'A' ? match.side_a.name : match.side_b.name;

  async function handleSubmit() {
    if (!id) return;
    setSubmitting(true);
    const r = await postSubstituteRequest({
      match_id: id,
      side: mySide,
      position: position || null,
      count,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    Alert.alert(
      'Publicado',
      'O pedido aparece na lista de oportunidades abertas em ' +
        sideName +
        '. Os primeiros a aceitar entram no jogo.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Pedir substituto',
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
          <Eyebrow>{sideName}</Eyebrow>
          <Heading level={2} style={{ marginTop: 4 }}>
            Precisas de jogadores?
          </Heading>
          <Text style={styles.hint}>
            O pedido aparece em "Oportunidades abertas" para jogadores na tua
            cidade. Quem aceitar entra automaticamente no jogo.
          </Text>

          <Eyebrow style={{ marginTop: 24 }}>Posição</Eyebrow>
          <View style={styles.posRow}>
            {POSITIONS.map((p) => {
              const active = position === p.v;
              return (
                <Pressable
                  key={p.v || 'any'}
                  onPress={() => setPosition(p.v)}
                  style={[styles.posChip, active && styles.posChipActive]}
                >
                  <Text
                    style={[
                      styles.posChipText,
                      active && styles.posChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Eyebrow style={{ marginTop: 24 }}>Quantos?</Eyebrow>
          <View style={styles.countRow}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Pressable
                key={n}
                onPress={() => setCount(n)}
                style={[styles.countBtn, count === n && styles.countBtnActive]}
              >
                <Text
                  style={[
                    styles.countText,
                    count === n && styles.countTextActive,
                  ]}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </View>

          <Eyebrow style={{ marginTop: 24 }}>Notas (opcional)</Eyebrow>
          <Card style={{ marginTop: 8, padding: 0 }}>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Equipamento, nível desejado, urgência..."
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={200}
              textAlignVertical="top"
              editable={!submitting}
            />
          </Card>

          <View style={{ marginTop: 24 }}>
            <Button
              label="Publicar pedido"
              size="lg"
              haptic="medium"
              loading={submitting}
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
  posRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  posChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  posChipActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  posChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  posChipTextActive: { color: '#0a0a0a' },
  countRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  countBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBtnActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  countText: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '800',
  },
  countTextActive: { color: '#0a0a0a' },
  input: {
    padding: 14,
    minHeight: 70,
    color: colors.text,
    fontSize: 15,
  },
});
