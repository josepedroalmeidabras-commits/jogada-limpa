import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/providers/auth';
import {
  fetchMatchParticipants,
  submitMatchSelfReport,
  type MatchParticipant,
} from '@/lib/result';
import { Screen } from '@/components/Screen';
import { Heading, Eyebrow } from '@/components/Heading';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

export default function SelfReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [me, setMe] = useState<MatchParticipant | null>(null);
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id || !session) return;
    const list = await fetchMatchParticipants(id);
    const mine = list.find((p) => p.user_id === session.user.id) ?? null;
    setMe(mine);
    if (mine?.self_reported_goals !== null && mine?.self_reported_goals !== undefined) {
      setGoals(mine.self_reported_goals);
      setAssists(mine.self_reported_assists ?? 0);
    }
    setLoading(false);
  }, [id, session]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (!id) return;
    setSubmitting(true);
    const r = await submitMatchSelfReport({ matchId: id, goals, assists });
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    Alert.alert(
      'Obrigado',
      'O teu capitão vai validar antes do resultado final ser submetido.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.text} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  if (!me) {
    return (
      <Screen>
        <View style={{ padding: 24, marginTop: 40, alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted }}>
            Não participaste neste jogo.
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
          headerTitle: 'Reportar contribuição',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <Eyebrow>Marcaste ou assististe?</Eyebrow>
          <Heading level={2} style={{ marginTop: 6 }}>
            Diz ao capitão
          </Heading>
          <Text style={styles.body}>
            Tu sabes melhor que ninguém — diz os teus números e o capitão
            valida antes de submeter o resultado final.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={{ marginTop: 24 }}
        >
          <Card>
            <Stepper
              icon="football"
              iconColor={colors.warning}
              label="Golos"
              value={goals}
              onChange={setGoals}
              disabled={submitting}
            />
            <View style={styles.divider} />
            <Stepper
              icon="hand-right"
              iconColor={colors.success}
              label="Assistências"
              value={assists}
              onChange={setAssists}
              disabled={submitting}
            />
          </Card>
        </Animated.View>

        <View style={{ marginTop: 28 }}>
          <Button
            label={
              me.self_reported_at ? 'Atualizar' : 'Reportar'
            }
            size="lg"
            haptic="medium"
            loading={submitting}
            onPress={handleSubmit}
            full
          />
        </View>

        {me.self_reported_at && (
          <Text style={styles.hint}>
            Já reportaste — podes atualizar até o capitão submeter o resultado.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stepper({
  icon,
  iconColor,
  label,
  value,
  onChange,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <View style={styles.stepperIcon}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepperLabel}>{label}</Text>
      </View>
      <View style={styles.stepperControls}>
        <Pressable
          onPress={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value === 0}
          style={[styles.stepperBtn, value === 0 && styles.stepperBtnDim]}
        >
          <Ionicons name="remove" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(20, value + 1))}
          disabled={disabled || value >= 20}
          style={[styles.stepperBtn, value >= 20 && styles.stepperBtnDim]}
        >
          <Ionicons name="add" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 14,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDim: { opacity: 0.4 },
  stepperValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    minWidth: 28,
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 18,
  },
});
