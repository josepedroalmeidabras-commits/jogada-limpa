import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/providers/auth';
import { fetchMatchById, type MatchSummary } from '@/lib/matches';
import {
  fetchMatchParticipants,
  type MatchParticipant,
} from '@/lib/result';
import { assignInternalSides } from '@/lib/internal-match';
import { positionShort } from '@/lib/teams';
import { Avatar } from '@/components/Avatar';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Heading, Eyebrow } from '@/components/Heading';
import { Button } from '@/components/Button';
import { colors } from '@/theme';

type Assign = Record<string, 'A' | 'B' | undefined>;

export default function SplitInternalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [participants, setParticipants] = useState<MatchParticipant[]>([]);
  const [assign, setAssign] = useState<Assign>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [m, p] = await Promise.all([
      fetchMatchById(id),
      fetchMatchParticipants(id),
    ]);
    setMatch(m);
    setParticipants(p);
    // Seed assignment from current side values (only for accepted players)
    const initial: Assign = {};
    for (const part of p) {
      if (part.invitation_status === 'accepted') {
        initial[part.user_id] = part.side;
      }
    }
    setAssign(initial);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const accepted = useMemo(
    () => participants.filter((p) => p.invitation_status === 'accepted'),
    [participants],
  );
  const sideA = useMemo(
    () => accepted.filter((p) => assign[p.user_id] === 'A'),
    [accepted, assign],
  );
  const sideB = useMemo(
    () => accepted.filter((p) => assign[p.user_id] === 'B'),
    [accepted, assign],
  );
  const unassigned = useMemo(
    () => accepted.filter((p) => !assign[p.user_id]),
    [accepted, assign],
  );

  function assignTo(uid: string, side: 'A' | 'B' | undefined) {
    setAssign((prev) => ({ ...prev, [uid]: side }));
  }

  function autoShuffle() {
    const ids = accepted.map((p) => p.user_id).sort(() => Math.random() - 0.5);
    const half = Math.ceil(ids.length / 2);
    const next: Assign = {};
    ids.forEach((uid, i) => {
      next[uid] = i < half ? 'A' : 'B';
    });
    setAssign(next);
  }

  async function handleSave() {
    if (!id) return;
    if (sideA.length === 0 || sideB.length === 0) {
      Alert.alert('Falta dividir', 'Cada lado precisa de pelo menos 1 jogador.');
      return;
    }
    setSubmitting(true);
    const r = await assignInternalSides(
      id,
      sideA.map((p) => p.user_id),
      sideB.map((p) => p.user_id),
    );
    setSubmitting(false);
    if (!r.ok) {
      Alert.alert('Erro', r.message);
      return;
    }
    router.back();
  }

  if (loading) return <Screen>{null}</Screen>;
  const isCaptain =
    match?.side_a.captain_id === session?.user.id ||
    match?.side_b.captain_id === session?.user.id;
  if (!match || !match.is_internal || !isCaptain) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>
            Só o capitão pode dividir os lados de uma peladinha.
          </Text>
        </View>
      </Screen>
    );
  }

  const labelA = match.side_a_label ?? 'Lado A';
  const labelB = match.side_b_label ?? 'Lado B';

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Dividir lados',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Eyebrow>Peladinha</Eyebrow>
        <Heading level={2} style={{ marginTop: 4 }}>
          {`${labelA} vs ${labelB}`}
        </Heading>
        <Text style={styles.hint}>
          {`${accepted.length} confirmado${accepted.length === 1 ? '' : 's'} · ${sideA.length} vs ${sideB.length}`}
        </Text>

        <View style={styles.actionsRow}>
          <Pressable onPress={autoShuffle} style={styles.utilBtn}>
            <Ionicons name="shuffle" size={14} color={colors.brand} />
            <Text style={styles.utilBtnText}>Sortear</Text>
          </Pressable>
          <Pressable onPress={() => setAssign({})} style={styles.utilBtn}>
            <Text style={styles.utilBtnText}>Limpar</Text>
          </Pressable>
        </View>

        <Text style={[styles.sideHeader, { color: '#34d399' }]}>
          {`${labelA} · ${sideA.length}`}
        </Text>
        {sideA.length === 0 && (
          <Text style={styles.sideEmpty}>Ninguém atribuído ainda.</Text>
        )}
        {sideA.map((p) => (
          <PlayerRow
            key={p.user_id}
            participant={p}
            side="A"
            labelA={labelA}
            labelB={labelB}
            onAssign={(s) => assignTo(p.user_id, s)}
          />
        ))}

        <Text style={[styles.sideHeader, { color: '#fbbf24', marginTop: 16 }]}>
          {`${labelB} · ${sideB.length}`}
        </Text>
        {sideB.length === 0 && (
          <Text style={styles.sideEmpty}>Ninguém atribuído ainda.</Text>
        )}
        {sideB.map((p) => (
          <PlayerRow
            key={p.user_id}
            participant={p}
            side="B"
            labelA={labelA}
            labelB={labelB}
            onAssign={(s) => assignTo(p.user_id, s)}
          />
        ))}

        {unassigned.length > 0 && (
          <>
            <Text style={[styles.sideHeader, { marginTop: 16 }]}>
              {`Por atribuir · ${unassigned.length}`}
            </Text>
            {unassigned.map((p) => (
              <PlayerRow
                key={p.user_id}
                participant={p}
                side={undefined}
                labelA={labelA}
                labelB={labelB}
                onAssign={(s) => assignTo(p.user_id, s)}
              />
            ))}
          </>
        )}

        <View style={{ marginTop: 24 }}>
          <Button
            label="Guardar divisão"
            size="lg"
            haptic="medium"
            loading={submitting}
            disabled={sideA.length === 0 || sideB.length === 0}
            onPress={handleSave}
            full
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function PlayerRow({
  participant,
  side,
  labelA,
  labelB,
  onAssign,
}: {
  participant: MatchParticipant;
  side: 'A' | 'B' | undefined;
  labelA: string;
  labelB: string;
  onAssign: (side: 'A' | 'B' | undefined) => void;
}) {
  const name = participant.profile?.name ?? 'Jogador';
  return (
    <View style={styles.playerRow}>
      <Avatar
        url={participant.profile?.photo_url ?? null}
        name={name}
        size={32}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.playerName} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View style={styles.sideBtns}>
        <Pressable
          onPress={() => onAssign(side === 'A' ? undefined : 'A')}
          style={[styles.sideBtn, side === 'A' && styles.sideBtnAActive]}
        >
          <Text
            style={[styles.sideBtnText, side === 'A' && { color: '#0a0a0a' }]}
            numberOfLines={1}
          >
            {labelA}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onAssign(side === 'B' ? undefined : 'B')}
          style={[styles.sideBtn, side === 'B' && styles.sideBtnBActive]}
        >
          <Text
            style={[styles.sideBtnText, side === 'B' && { color: '#0a0a0a' }]}
            numberOfLines={1}
          >
            {labelB}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 12, lineHeight: 19 },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
    marginBottom: 6,
  },
  utilBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
  },
  utilBtnText: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  sideHeader: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 6,
  },
  sideEmpty: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  playerName: { color: colors.text, fontSize: 14, fontWeight: '500' },
  sideBtns: { flexDirection: 'row', gap: 6 },
  sideBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgElevated,
    maxWidth: 110,
  },
  sideBtnAActive: { backgroundColor: '#34d399', borderColor: '#34d399' },
  sideBtnBActive: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  sideBtnText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
});
