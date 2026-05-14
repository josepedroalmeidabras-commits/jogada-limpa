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
import { fetchMatchById } from '@/lib/matches';
import { fetchReferee, submitRefereeReview, type RefereeProfile } from '@/lib/referee';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Eyebrow, Heading } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

type Scores = {
  fair_play: number;
  punctuality: number;
  technical_level: number;
};

const CATEGORIES: Array<{ key: keyof Scores; label: string; hint: string }> = [
  {
    key: 'fair_play',
    label: 'Consistência',
    hint: 'Foi consistente nas decisões?',
  },
  {
    key: 'punctuality',
    label: 'Pontualidade',
    hint: 'Chegou a horas, geriu o tempo?',
  },
  {
    key: 'technical_level',
    label: 'Critério técnico',
    hint: 'Conhecia as regras, leu bem o jogo?',
  },
];

export default function RefereeReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [referee, setReferee] = useState<RefereeProfile | null>(null);
  const [scores, setScores] = useState<Scores>({
    fair_play: 4,
    punctuality: 4,
    technical_level: 4,
  });
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const m = await fetchMatchById(id);
      if (cancelled) return;
      if (m?.referee_id) {
        const ref = await fetchReferee(m.referee_id);
        if (!cancelled) setReferee(ref);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function pick(key: keyof Scores, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!id) return;
    setSubmitting(true);
    const r = await submitRefereeReview({
      match_id: id,
      ...scores,
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
  if (!referee) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>Sem árbitro neste jogo.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Avaliar árbitro',
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
          <Animated.View
            entering={FadeInDown.duration(300).springify()}
            style={styles.hero}
          >
            <Avatar url={referee.photo_url} name={referee.name} size={64} />
            <Heading level={2} style={{ marginTop: 12 }}>
              {referee.name}
            </Heading>
            <Text style={styles.heroSub}>Árbitro neste jogo</Text>
          </Animated.View>

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
              placeholder="Construtivo. O comentário aparece anónimo após 72h."
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
              label="Enviar avaliação"
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
  muted: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  hero: { alignItems: 'center' },
  heroSub: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
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
