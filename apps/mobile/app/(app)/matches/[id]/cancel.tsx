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
import { cancelConfirmedMatch } from '@/lib/matches';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

const PRESET_REASONS = [
  'Sem jogadores suficientes',
  'Lesão de jogador importante',
  'Condições climatéricas',
  'Conflito de agenda',
  'Campo indisponível',
];

export default function CancelMatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finalReason = reason ?? custom.trim();
  const canSubmit = finalReason.length >= 4;

  async function handleSubmit() {
    if (!id || !canSubmit) return;
    Alert.alert(
      'Cancelar este jogo?',
      'A outra equipa vai ser notificada. Não pode ser desfeito.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar jogo',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            const r = await cancelConfirmedMatch(id, finalReason);
            setSubmitting(false);
            if (!r.ok) {
              Alert.alert('Erro', r.message);
              return;
            }
            router.back();
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Cancelar jogo',
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
          <Eyebrow>Cancelar</Eyebrow>
          <Heading level={2} style={{ marginTop: 4 }}>
            Porque queres cancelar?
          </Heading>
          <Text style={styles.hint}>
            A outra equipa é notificada com este motivo. Sê transparente — a
            tua reputação conta.
          </Text>

          <View style={{ marginTop: 20, gap: 8 }}>
            {PRESET_REASONS.map((r) => {
              const active = reason === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => {
                    setReason(r);
                    setCustom('');
                  }}
                  style={[styles.reasonRow, active && styles.reasonRowActive]}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      active && styles.reasonTextActive,
                    ]}
                  >
                    {r}
                  </Text>
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

          <Eyebrow style={{ marginTop: 24 }}>Outro motivo</Eyebrow>
          <Card style={{ marginTop: 8, padding: 0 }}>
            <TextInput
              style={styles.input}
              value={custom}
              onChangeText={(t) => {
                setCustom(t);
                if (t.length > 0) setReason(null);
              }}
              placeholder="Escreve aqui se nenhum dos motivos servir."
              placeholderTextColor={colors.textFaint}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!submitting}
            />
          </Card>

          <View style={{ marginTop: 24 }}>
            <Button
              label="Cancelar jogo"
              size="lg"
              haptic="medium"
              variant="danger"
              loading={submitting}
              disabled={!canSubmit}
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
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  reasonText: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  reasonTextActive: { color: colors.brand },
  input: {
    padding: 14,
    minHeight: 90,
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
});
