import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  fetchMatchById,
  updateMatchNotes,
  type MatchSummary,
} from '@/lib/matches';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export default function MatchNotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const m = await fetchMatchById(id);
      if (cancelled) return;
      setMatch(m);
      setNotes(m?.notes ?? '');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSubmitting(true);
    const r = await updateMatchNotes(id, notes);
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    router.back();
  }

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Notas do jogo',
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
          <Eyebrow>Notas partilhadas</Eyebrow>
          <Heading level={2} style={{ marginTop: 4 }}>
            Antes do jogo
          </Heading>
          <Text style={styles.hint}>
            Visível para ambas as equipas. Útil para combinar cor de
            equipamento, balneário, hora de chegada, etc.
          </Text>

          <Card style={{ marginTop: 16, padding: 0 }}>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Vamos de branco. Encontramos-nos no balneário 2 às 18h45."
              placeholderTextColor={colors.textFaint}
              multiline
              numberOfLines={6}
              maxLength={300}
              textAlignVertical="top"
              editable={!submitting}
              autoFocus
            />
          </Card>
          <Text style={styles.counter}>{`${notes.length} / 300`}</Text>

          <View style={{ marginTop: 24 }}>
            <Button
              label="Guardar"
              size="lg"
              haptic="medium"
              loading={submitting}
              onPress={handleSave}
              full
            />
          </View>

          {match?.notes && notes.trim() === '' && (
            <Text style={styles.warn}>
              ⚠️ Se guardares vazio, as notas atuais são apagadas.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 19 },
  input: {
    padding: 14,
    minHeight: 140,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  counter: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  warn: {
    color: '#fbbf24',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
});
