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
import { Ionicons } from '@expo/vector-icons';
import {
  reportUser,
  REPORT_REASON_LABELS,
  type ReportReason,
} from '@/lib/moderation';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export default function ReportUserScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reasons = Object.entries(REPORT_REASON_LABELS) as Array<
    [ReportReason, string]
  >;

  async function handleSubmit() {
    if (!id || !reason) return;
    setSubmitting(true);
    const r = await reportUser({
      reportedId: id,
      reason,
      details: details.trim() || undefined,
    });
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message ?? 'Não foi possível enviar.');
      return;
    }
    Alert.alert(
      'Recebido',
      'Obrigado. Vamos rever e tomar acção se necessário.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Reportar',
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
          <Eyebrow>A reportar</Eyebrow>
          <Heading level={2} style={{ marginTop: 4 }}>
            {name ?? 'Jogador'}
          </Heading>

          <Eyebrow style={{ marginTop: 24 }}>Motivo</Eyebrow>
          <View style={{ marginTop: 8, gap: 8 }}>
            {reasons.map(([key, label]) => {
              const active = reason === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setReason(key)}
                  style={[
                    styles.reasonRow,
                    active && styles.reasonRowActive,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.reasonText,
                        active && styles.reasonTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.brand}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          <Eyebrow style={{ marginTop: 24 }}>Detalhes (opcional)</Eyebrow>
          <Card style={{ marginTop: 8, padding: 0 }}>
            <TextInput
              style={styles.input}
              value={details}
              onChangeText={setDetails}
              placeholder="O que aconteceu? Em que jogo? Quando?"
              placeholderTextColor={colors.textFaint}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!submitting}
            />
          </Card>

          <Text style={styles.disclaimer}>
            As denúncias são confidenciais. A equipa S7VN revê e toma
            acção quando aplicável.
          </Text>

          <View style={{ marginTop: 24 }}>
            <Button
              label="Enviar denúncia"
              size="lg"
              haptic="medium"
              loading={submitting}
              disabled={!reason}
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
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
  },
  reasonRowActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  reasonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  reasonTextActive: { color: colors.brand },
  input: {
    padding: 14,
    minHeight: 110,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  disclaimer: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 16,
    lineHeight: 18,
  },
});
