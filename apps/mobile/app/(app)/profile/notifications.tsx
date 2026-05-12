import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Stack } from 'expo-router';
import { useAuth } from '@/providers/auth';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/notification-preferences';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Eyebrow } from '@/components/Heading';
import { colors } from '@/theme';

type Key = keyof Omit<
  NotificationPreferences,
  'user_id' | 'quiet_hours_start' | 'quiet_hours_end'
>;

type Item = { key: Key; label: string; hint?: string };

const PUSH_ITEMS: Item[] = [
  {
    key: 'match_invite_push',
    label: 'Convites para jogo',
    hint: 'Quando outra equipa te propõe ou aceita um jogo.',
  },
  {
    key: 'match_confirmed_push',
    label: 'Jogo confirmado',
    hint: 'Quando ambas as equipas confirmam.',
  },
  {
    key: 'reminder_24h_push',
    label: 'Lembrete 24h antes',
  },
  {
    key: 'reminder_2h_push',
    label: 'Lembrete 2h antes',
  },
  {
    key: 'result_pending_push',
    label: 'Resultado por submeter',
    hint: 'Após o jogo, quando falta inserir o resultado.',
  },
  {
    key: 'review_pending_push',
    label: 'Avaliação pendente',
    hint: 'Quando podes avaliar adversários.',
  },
];

const EMAIL_ITEMS: Item[] = [
  {
    key: 'result_pending_email',
    label: 'Resultado por submeter',
  },
  {
    key: 'review_pending_email',
    label: 'Avaliação pendente',
  },
  {
    key: 'weekly_digest_email',
    label: 'Resumo semanal',
    hint: 'Estatísticas e jogos da semana.',
  },
  {
    key: 'marketing_email',
    label: 'Novidades e melhorias',
    hint: 'Anúncios de novas funcionalidades.',
  },
];

export default function NotificationPreferencesScreen() {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const p = await fetchNotificationPreferences(session.user.id);
      if (cancelled) return;
      setPrefs(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function toggle(key: Key) {
    if (!session || !prefs) return;
    const next = !prefs[key];
    setPrefs({ ...prefs, [key]: next });
    setError(null);
    const r = await updateNotificationPreferences(session.user.id, {
      [key]: next,
    });
    if (!r.ok) {
      setPrefs({ ...prefs, [key]: !next });
      setError(r.message ?? 'Não foi possível guardar.');
    }
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Notificações',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading || !prefs ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(300).springify()}>
              <Eyebrow>Push</Eyebrow>
              <Text style={styles.sectionHint}>
                Notificações instantâneas no telemóvel.
              </Text>
              <Card style={{ marginTop: 12, padding: 0 }}>
                {PUSH_ITEMS.map((item, i) => (
                  <ToggleRow
                    key={item.key}
                    label={item.label}
                    hint={item.hint}
                    value={!!prefs[item.key]}
                    onToggle={() => toggle(item.key)}
                    isLast={i === PUSH_ITEMS.length - 1}
                  />
                ))}
              </Card>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.delay(80).springify()}
              style={{ marginTop: 24 }}
            >
              <Eyebrow>Email</Eyebrow>
              <Text style={styles.sectionHint}>
                Recebes no email associado à conta.
              </Text>
              <Card style={{ marginTop: 12, padding: 0 }}>
                {EMAIL_ITEMS.map((item, i) => (
                  <ToggleRow
                    key={item.key}
                    label={item.label}
                    hint={item.hint}
                    value={!!prefs[item.key]}
                    onToggle={() => toggle(item.key)}
                    isLast={i === EMAIL_ITEMS.length - 1}
                  />
                ))}
              </Card>
            </Animated.View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.footHint}>
              Horas silenciosas estão entre as 23:00 e as 08:00.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onToggle,
  isLast,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.row, !isLast && styles.rowDivider]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <View style={[styles.toggle, value && styles.toggleOn]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: { paddingVertical: 48, alignItems: 'center' },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  rowLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowHint: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.brand },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  error: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  footHint: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 20,
    textAlign: 'center',
  },
});
