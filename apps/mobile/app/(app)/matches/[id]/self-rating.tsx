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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  fetchMySelfRating,
  submitSelfRating,
  type SelfRatingScores,
} from '@/lib/self-rating';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

type CategoryKey = keyof SelfRatingScores;

const CATEGORIES: Array<{ key: CategoryKey; label: string; hint: string }> = [
  {
    key: 'fair_play',
    label: 'Fair play',
    hint: 'Respeito pelos adversários e regras.',
  },
  {
    key: 'punctuality',
    label: 'Pontualidade',
    hint: 'Chegaste a horas? Cumpriste o combinado?',
  },
  {
    key: 'technical_level',
    label: 'Nível técnico',
    hint: 'Como te saíste em campo.',
  },
  {
    key: 'attitude',
    label: 'Atitude',
    hint: 'Espírito de equipa, postura, vibe.',
  },
];

export default function SelfRatingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [scores, setScores] = useState<SelfRatingScores>({
    fair_play: 4,
    punctuality: 4,
    technical_level: 4,
    attitude: 4,
  });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const existing = await fetchMySelfRating(id);
      if (cancelled) return;
      if (existing) {
        setScores({
          fair_play: existing.fair_play,
          punctuality: existing.punctuality,
          technical_level: existing.technical_level,
          attitude: existing.attitude,
        });
        setComment(existing.comment ?? '');
        setHasExisting(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function pick(key: CategoryKey, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!id) return;
    setSubmitting(true);
    const r = await submitSelfRating({
      match_id: id,
      scores,
      comment: comment.trim() || undefined,
    });
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    router.back();
  }

  if (loading) return <Screen>{null}</Screen>;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Auto-avaliar',
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
          <Eyebrow>Como achas que jogaste?</Eyebrow>
          <Heading level={2} style={{ marginTop: 4 }}>
            {hasExisting ? 'Atualiza a tua nota' : 'Dá-te uma nota'}
          </Heading>
          <Text style={styles.hint}>
            Honestidade compensa: os colegas vão ver se a tua auto-avaliação
            bate certo com a deles. Diverte-te.
          </Text>

          {CATEGORIES.map((cat, i) => {
            const v = scores[cat.key];
            return (
              <Animated.View
                key={cat.key}
                entering={FadeInDown.delay(60 + i * 30).springify()}
                style={styles.section}
              >
                <Eyebrow>{cat.label}</Eyebrow>
                <Text style={styles.catHint}>{cat.hint}</Text>
                <View style={styles.pickerRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => pick(cat.key, n)}
                      style={[
                        styles.pickerBtn,
                        v === n && styles.pickerBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerText,
                          v === n && styles.pickerTextActive,
                        ]}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            );
          })}

          <Eyebrow style={{ marginTop: 24 }}>Comentário (opcional)</Eyebrow>
          <Card style={{ marginTop: 8, padding: 0 }}>
            <TextInput
              style={styles.input}
              value={comment}
              onChangeText={setComment}
              placeholder="Auto-crítica honesta, troça simpática, qualquer coisa."
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={200}
              textAlignVertical="top"
              editable={!submitting}
            />
          </Card>
          <Text style={styles.counter}>{`${comment.length} / 200`}</Text>

          <View style={{ marginTop: 24 }}>
            <Button
              label={hasExisting ? 'Atualizar nota' : 'Guardar auto-avaliação'}
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
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 19 },
  section: { marginTop: 20 },
  catHint: { color: colors.textDim, fontSize: 12, marginTop: 4, marginBottom: 10 },
  pickerRow: { flexDirection: 'row', gap: 8 },
  pickerBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBtnActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  pickerText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pickerTextActive: { color: '#0E1812' },
  input: {
    padding: 14,
    minHeight: 90,
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
});
